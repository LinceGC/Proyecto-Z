(() => {
  const state = {
    activeInput: null,
    originalFile: null,
    dialogHost: null,
    dialogEl: null,
    resolver: null,
    suppressNextInputEvent: false
  };

  const openEditorForFile = (file, input) => {
    return new Promise((resolve) => {
      state.activeInput = input;
      state.originalFile = file;
      state.resolver = resolve;

      const host = document.createElement('div');
      host.style.position = 'fixed';
      host.style.inset = '0';
      host.style.zIndex = '2147483647';
      host.style.background = 'rgba(0, 0, 0, 0.25)';
      document.documentElement.appendChild(host);
      state.dialogHost = host;

      const iframe = document.createElement('iframe');
      iframe.src = chrome.runtime.getURL('editor.html');
      iframe.style.border = 'none';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.display = 'block';
      iframe.setAttribute('title', 'Mosaic Censorship Editor');
      host.appendChild(iframe);
      state.dialogEl = iframe;

      iframe.addEventListener('load', () => {
        const reader = new FileReader();
        reader.onload = () => {
          iframe.contentWindow.postMessage(
            {
              type: 'MOSAIC_EDITOR_INIT',
              payload: {
                name: file.name,
                mimeType: file.type,
                dataUrl: reader.result
              }
            },
            '*'
          );
        };
        reader.readAsDataURL(file);
      }, { once: true });
    });
  };

  const closeEditor = () => {
    if (state.dialogHost && state.dialogHost.parentNode) {
      state.dialogHost.parentNode.removeChild(state.dialogHost);
    }
    state.activeInput = null;
    state.originalFile = null;
    state.dialogHost = null;
    state.dialogEl = null;
    state.resolver = null;
  };

  const replaceFileOnInput = (input, newFile) => {
    const dt = new DataTransfer();
    dt.items.add(newFile);

    state.suppressNextInputEvent = true;
    input.files = dt.files;

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const shouldHandleInput = (input) => {
    if (!input || input.type !== 'file' || input.disabled) {
      return false;
    }

    const { files } = input;
    if (!files || files.length !== 1) {
      return false;
    }

    const file = files[0];
    return file && typeof file.type === 'string' && file.type.startsWith('image/');
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
      const { blobBase64, fileName } = msg.payload || {};
      if (!blobBase64 || !state.activeInput || !state.originalFile) {
        const resolver = state.resolver;
        closeEditor();
        if (resolver) resolver({ canceled: true, error: 'invalid-payload' });
        return;
      }

      const binary = atob(blobBase64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }

      const newFile = new File([bytes], fileName || state.originalFile.name, {
        type: 'image/png'
      });

      const input = state.activeInput;
      const resolver = state.resolver;
      closeEditor();
      replaceFileOnInput(input, newFile);
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

      const file = input.files[0];
      try {
        await openEditorForFile(file, input);
      } catch (err) {
        // If editor fails, keep original file selected.
        console.error('Failed to open mosaic editor:', err);
      }
    },
    true
  );
})();
