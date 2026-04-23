(() => {
  const ENABLED_KEY = 'heycensorEnabled';
  const EDITOR_LOAD_TIMEOUT_MS = 10000;

  const state = {
    activeInput: null,
    originalFiles: [],
    dialogHost: null,
    dialogEl: null,
    resolver: null,
    suppressNextInputEvent: false,
    enabled: true
  };

  const initEnabledState = () => {
    chrome.storage.local.get({ [ENABLED_KEY]: true }, (result) => {
      if (chrome.runtime.lastError) {
        state.enabled = true;
        return;
      }

      state.enabled = Boolean(result[ENABLED_KEY]);
    });
  };

  initEnabledState();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes[ENABLED_KEY] && typeof changes[ENABLED_KEY].newValue === 'boolean') {
      state.enabled = changes[ENABLED_KEY].newValue;
    }
  });

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  const closeEditor = () => {
    if (state.dialogHost && state.dialogHost.parentNode) {
      state.dialogHost.parentNode.removeChild(state.dialogHost);
    }
    state.activeInput = null;
    state.originalFiles = [];
    state.dialogHost = null;
    state.dialogEl = null;
    state.resolver = null;
  };

  const waitForIframeLoad = (iframe) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('editor-load-timeout')), EDITOR_LOAD_TIMEOUT_MS);

      const onLoad = () => {
        clearTimeout(timer);
        resolve();
      };

      const onError = () => {
        clearTimeout(timer);
        reject(new Error('editor-load-error'));
      };

      iframe.addEventListener('load', onLoad, { once: true });
      iframe.addEventListener('error', onError, { once: true });
    });

  const openEditorForFiles = async (files, input) => {
    if (state.dialogHost) {
      throw new Error('editor-already-open');
    }

    return new Promise(async (resolve, reject) => {
      try {
        state.activeInput = input;
        state.originalFiles = files;
        state.resolver = resolve;

        const host = document.createElement('div');
        host.style.position = 'fixed';
        host.style.inset = '0';
        host.style.zIndex = '2147483647';
        host.style.background = 'rgba(0, 0, 0, 0.25)';
        document.documentElement.appendChild(host);
        state.dialogHost = host;

        const iframe = document.createElement('iframe');
        iframe.style.border = 'none';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.display = 'block';
        iframe.setAttribute('title', 'Mosaic Censorship Editor');
        host.appendChild(iframe);
        state.dialogEl = iframe;

        // IMPORTANT: start listening for iframe load BEFORE assigning src.
        const iframeLoadedPromise = waitForIframeLoad(iframe);
        iframe.src = chrome.runtime.getURL('editor.html');

        const payloadPromise = Promise.all(
          files.map(async (file) => ({
            name: file.name,
            mimeType: file.type,
            dataUrl: await readFileAsDataUrl(file)
          }))
        );

        const [payloadFiles] = await Promise.all([payloadPromise, iframeLoadedPromise]);

        iframe.contentWindow.postMessage(
          {
            type: 'MOSAIC_EDITOR_INIT',
            payload: {
              files: payloadFiles
            }
          },
          '*'
        );
      } catch (error) {
        const resolver = state.resolver;
        closeEditor();
        reject(error);
        if (resolver) resolver({ canceled: true, error: 'editor-open-failed' });
      }
    });
  };

  const replaceFilesOnInput = (input, newFiles) => {
    const dt = new DataTransfer();
    for (const file of newFiles) {
      dt.items.add(file);
    }

    state.suppressNextInputEvent = true;
    input.files = dt.files;

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const shouldHandleInput = (input) => {
    if (!input || input.type !== 'file' || input.disabled || !state.enabled) {
      return false;
    }

    const { files } = input;
    if (!files || files.length < 1) {
      return false;
    }

    return Array.from(files).every((file) => file && typeof file.type === 'string' && file.type.startsWith('image/'));
  };

  const restoreNativeFlow = (input) => {
    if (!input) return;
    state.suppressNextInputEvent = true;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  window.addEventListener('message', (event) => {
    if (!state.dialogEl || event.source !== state.dialogEl.contentWindow) {
      return;
    }

    const msg = event.data;
    if (!msg || typeof msg !== 'object') {
      return;
    }

    if (msg.type === 'MOSAIC_EDITOR_CANCEL') {
      const resolver = state.resolver;
      closeEditor();
      if (resolver) resolver({ canceled: true });
      return;
    }

    if (msg.type === 'MOSAIC_EDITOR_CONFIRM') {
      const { files } = msg.payload || {};

      if (!Array.isArray(files) || files.length < 1 || !state.activeInput) {
        const resolver = state.resolver;
        closeEditor();
        if (resolver) resolver({ canceled: true, error: 'invalid-payload' });
        return;
      }

      const rebuiltFiles = files
        .filter((f) => f && typeof f.blobBase64 === 'string' && f.blobBase64.length > 0)
        .map((f, index) => {
          const binary = atob(f.blobBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
          }

          const fallbackName = state.originalFiles[index]?.name || `image-${index + 1}.png`;
          return new File([bytes], f.fileName || fallbackName, {
            type: 'image/png'
          });
        });

      if (rebuiltFiles.length < 1) {
        const resolver = state.resolver;
        closeEditor();
        if (resolver) resolver({ canceled: true, error: 'empty-output' });
        return;
      }

      const input = state.activeInput;
      const resolver = state.resolver;
      closeEditor();
      replaceFilesOnInput(input, rebuiltFiles);
      if (resolver) resolver({ canceled: false });
    }
  });

  document.addEventListener(
    'change',
    async (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== 'file') {
        return;
      }

      if (state.suppressNextInputEvent) {
        state.suppressNextInputEvent = false;
        return;
      }

      if (!shouldHandleInput(input)) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      const files = Array.from(input.files || []);
      try {
        await openEditorForFiles(files, input);
      } catch (err) {
        console.error('Failed to open mosaic editor:', err);
        restoreNativeFlow(input);
      }
    },
    true
  );
})();
