(() => {
  const MAX_PREVIEW_W = 1200;
  const MAX_PREVIEW_H = 850;

  const state = {
    images: [],
    currentIndex: 0,
    drag: null,
    mosaicSize: 15
  };

  const canvas = document.getElementById('previewCanvas');
  const ctx = canvas.getContext('2d');
  const fileNameEl = document.getElementById('fileName');
  const rectCountEl = document.getElementById('rectCount');
  const imageIndexEl = document.getElementById('imageIndex');
  const undoBtn = document.getElementById('undoBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const confirmBtn = document.getElementById('confirmBtn');
  const mosaicSizeInput = document.getElementById('mosaicSizeInput');

  const normalizeRect = (rect) => {
    const x = Math.min(rect.x1, rect.x2);
    const y = Math.min(rect.y1, rect.y2);
    const w = Math.abs(rect.x2 - rect.x1);
    const h = Math.abs(rect.y2 - rect.y1);
    return { x, y, w, h };
  };

  const clampRectToBounds = (rect, maxW, maxH) => {
    const nx = Math.max(0, Math.min(rect.x, maxW));
    const ny = Math.max(0, Math.min(rect.y, maxH));
    const nw = Math.max(0, Math.min(rect.w, maxW - nx));
    const nh = Math.max(0, Math.min(rect.h, maxH - ny));
    return { x: nx, y: ny, w: nw, h: nh };
  };

  const drawMosaicRegion = (targetCtx, x, y, w, h, mosaicSize) => {
    if (w <= 1 || h <= 1 || mosaicSize <= 1) return;

    const smallW = Math.max(1, Math.floor(w / mosaicSize));
    const smallH = Math.max(1, Math.floor(h / mosaicSize));

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = smallW;
    tempCanvas.height = smallH;
    const tctx = tempCanvas.getContext('2d');

    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(targetCtx.canvas, x, y, w, h, 0, 0, smallW, smallH);

    targetCtx.imageSmoothingEnabled = false;
    targetCtx.drawImage(tempCanvas, 0, 0, smallW, smallH, x, y, w, h);
    targetCtx.imageSmoothingEnabled = true;
  };

  const getCurrent = () => state.images[state.currentIndex] || null;

  const toOriginalRect = (imgState, rectInPreview) => {
    const n = normalizeRect(rectInPreview);
    const scale = imgState.previewScale || 1;

    return clampRectToBounds(
      {
        x: Math.round(n.x / scale),
        y: Math.round(n.y / scale),
        w: Math.round(n.w / scale),
        h: Math.round(n.h / scale)
      },
      imgState.originalCanvas.width,
      imgState.originalCanvas.height
    );
  };

  const buildCompositedOriginal = (imgState) => {
    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = imgState.originalCanvas.width;
    compositeCanvas.height = imgState.originalCanvas.height;
    const compositeCtx = compositeCanvas.getContext('2d');
    compositeCtx.drawImage(imgState.originalCanvas, 0, 0);

    for (const rectRaw of imgState.rectangles) {
      const rect = toOriginalRect(imgState, rectRaw);
      if (rect.w < 2 || rect.h < 2) continue;
      drawMosaicRegion(compositeCtx, rect.x, rect.y, rect.w, rect.h, state.mosaicSize);
    }

    return compositeCanvas;
  };

  const render = () => {
    const current = getCurrent();
    if (!current) return;

    canvas.width = current.previewWidth;
    canvas.height = current.previewHeight;

    const compositeOriginal = buildCompositedOriginal(current);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(compositeOriginal, 0, 0, canvas.width, canvas.height);

    if (state.drag) {
      const preview = clampRectToBounds(normalizeRect(state.drag), canvas.width, canvas.height);
      if (preview.w >= 1 && preview.h >= 1) {
        ctx.save();
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(preview.x, preview.y, preview.w, preview.h);
        ctx.restore();
      }
    }

    fileNameEl.textContent = current.name;
    rectCountEl.textContent = String(current.rectangles.length);
    imageIndexEl.textContent = `${state.currentIndex + 1} / ${state.images.length}`;
    prevBtn.disabled = state.currentIndex === 0;
    nextBtn.disabled = state.currentIndex >= state.images.length - 1;
  };

  const getCanvasPoint = (event) => {
    const box = canvas.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * canvas.width;
    const y = ((event.clientY - box.top) / box.height) * canvas.height;
    return {
      x: Math.max(0, Math.min(canvas.width, x)),
      y: Math.max(0, Math.min(canvas.height, y))
    };
  };

  const createImageState = async ({ name, dataUrl }) => {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });

    const previewScale = Math.min(1, MAX_PREVIEW_W / img.width, MAX_PREVIEW_H / img.height);
    const previewWidth = Math.max(1, Math.round(img.width * previewScale));
    const previewHeight = Math.max(1, Math.round(img.height * previewScale));

    const originalCanvas = document.createElement('canvas');
    originalCanvas.width = img.width;
    originalCanvas.height = img.height;
    originalCanvas.getContext('2d').drawImage(img, 0, 0);

    return {
      name: name || 'image.png',
      originalCanvas,
      previewScale,
      previewWidth,
      previewHeight,
      rectangles: []
    };
  };

  const switchImage = (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= state.images.length) return;
    state.currentIndex = nextIndex;
    state.drag = null;
    render();
  };

  window.addEventListener('message', async (event) => {
    const msg = event.data;
    if (!msg || msg.type !== 'MOSAIC_EDITOR_INIT') return;

    const { files } = msg.payload || {};
    if (!Array.isArray(files) || files.length < 1) return;

    try {
      const imageStates = [];
      for (const file of files) {
        imageStates.push(await createImageState(file));
      }

      state.images = imageStates;
      state.currentIndex = 0;
      state.drag = null;
      render();
    } catch (error) {
      console.error('Failed to initialize editor images:', error);
      window.parent.postMessage({ type: 'MOSAIC_EDITOR_CANCEL' }, '*');
    }
  });

  canvas.addEventListener('mousedown', (event) => {
    const current = getCurrent();
    if (!current) return;
    const p = getCanvasPoint(event);
    state.drag = { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    render();
  });

  window.addEventListener('mousemove', (event) => {
    if (!state.drag) return;
    const p = getCanvasPoint(event);
    state.drag.x2 = p.x;
    state.drag.y2 = p.y;
    render();
  });

  window.addEventListener('mouseup', (event) => {
    const current = getCurrent();
    if (!state.drag || !current) return;

    const p = getCanvasPoint(event);
    state.drag.x2 = p.x;
    state.drag.y2 = p.y;

    const finalRect = clampRectToBounds(normalizeRect(state.drag), canvas.width, canvas.height);
    state.drag = null;

    if (finalRect.w >= 2 && finalRect.h >= 2) {
      current.rectangles.push({
        x1: finalRect.x,
        y1: finalRect.y,
        x2: finalRect.x + finalRect.w,
        y2: finalRect.y + finalRect.h
      });
    }

    render();
  });

  mosaicSizeInput.addEventListener('change', () => {
    const value = Number(mosaicSizeInput.value);
    if (!Number.isFinite(value) || value < 2) {
      mosaicSizeInput.value = String(state.mosaicSize);
      return;
    }
    state.mosaicSize = Math.floor(value);
    render();
  });

  undoBtn.addEventListener('click', () => {
    const current = getCurrent();
    if (current && current.rectangles.length > 0) {
      current.rectangles.pop();
      render();
    }
  });

  prevBtn.addEventListener('click', () => switchImage(state.currentIndex - 1));
  nextBtn.addEventListener('click', () => switchImage(state.currentIndex + 1));

  window.addEventListener('keydown', (event) => {
    const current = getCurrent();

    if (event.key.toLowerCase() === 'r' && current && current.rectangles.length > 0) {
      current.rectangles.pop();
      render();
    }

    if (event.key === 'ArrowLeft') {
      switchImage(state.currentIndex - 1);
    }

    if (event.key === 'ArrowRight') {
      switchImage(state.currentIndex + 1);
    }

    if (event.key === 'Escape') {
      cancelBtn.click();
    }
  });

  cancelBtn.addEventListener('click', () => {
    window.parent.postMessage({ type: 'MOSAIC_EDITOR_CANCEL' }, '*');
  });

  confirmBtn.addEventListener('click', async () => {
    if (!state.images.length) {
      window.parent.postMessage({ type: 'MOSAIC_EDITOR_CANCEL' }, '*');
      return;
    }

    const outputFiles = [];

    for (const imgState of state.images) {
      const fullCanvas = buildCompositedOriginal(imgState);

      // eslint-disable-next-line no-await-in-loop
      const blob = await new Promise((resolve) => fullCanvas.toBlob(resolve, 'image/png'));
      if (!blob) continue;

      // eslint-disable-next-line no-await-in-loop
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          resolve(result.includes(',') ? result.split(',')[1] : '');
        };
        reader.readAsDataURL(blob);
      });

      outputFiles.push({
        blobBase64: base64,
        fileName: imgState.name
      });
    }

    window.parent.postMessage(
      {
        type: 'MOSAIC_EDITOR_CONFIRM',
        payload: {
          files: outputFiles
        }
      },
      '*'
    );
  });
})();
