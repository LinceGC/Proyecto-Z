(() => {
  const MAX_PREVIEW_W = 1200;
  const MAX_PREVIEW_H = 850;

  const state = {
    originalImage: null,
    displayScale: 1,
    rectangles: [],
    drag: null,
    mosaicSize: 15,
    fileName: 'image.png'
  };

  const canvas = document.getElementById('previewCanvas');
  const ctx = canvas.getContext('2d');
  const fileNameEl = document.getElementById('fileName');
  const rectCountEl = document.getElementById('rectCount');
  const undoBtn = document.getElementById('undoBtn');
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

  const clampRectToCanvas = (rect) => {
    const maxX = canvas.width;
    const maxY = canvas.height;

    const nx = Math.max(0, Math.min(rect.x, maxX));
    const ny = Math.max(0, Math.min(rect.y, maxY));
    const nw = Math.max(0, Math.min(rect.w, maxX - nx));
    const nh = Math.max(0, Math.min(rect.h, maxY - ny));
    return { x: nx, y: ny, w: nw, h: nh };
  };

  const drawMosaicRegion = (targetCtx, x, y, w, h, mosaicSize) => {
    if (w <= 1 || h <= 1 || mosaicSize <= 1) {
      return;
    }

    const smallW = Math.max(1, Math.floor(w / mosaicSize));
    const smallH = Math.max(1, Math.floor(h / mosaicSize));

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = smallW;
    tempCanvas.height = smallH;
    const tctx = tempCanvas.getContext('2d');

    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(canvas, x, y, w, h, 0, 0, smallW, smallH);

    targetCtx.imageSmoothingEnabled = false;
    targetCtx.drawImage(tempCanvas, 0, 0, smallW, smallH, x, y, w, h);
    targetCtx.imageSmoothingEnabled = true;
  };

  const render = () => {
    if (!state.originalImage) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(state.originalImage, 0, 0, canvas.width, canvas.height);

    for (const rectRaw of state.rectangles) {
      const rectNorm = clampRectToCanvas(normalizeRect(rectRaw));
      if (rectNorm.w < 2 || rectNorm.h < 2) {
        continue;
      }
      drawMosaicRegion(ctx, rectNorm.x, rectNorm.y, rectNorm.w, rectNorm.h, state.mosaicSize);
    }

    if (state.drag) {
      const preview = clampRectToCanvas(normalizeRect(state.drag));
      if (preview.w >= 1 && preview.h >= 1) {
        ctx.save();
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(preview.x, preview.y, preview.w, preview.h);
        ctx.restore();
      }
    }

    rectCountEl.textContent = String(state.rectangles.length);
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

  const initCanvasForImage = (img) => {
    const scale = Math.min(1, MAX_PREVIEW_W / img.width, MAX_PREVIEW_H / img.height);
    state.displayScale = scale;
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
  };

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || msg.type !== 'MOSAIC_EDITOR_INIT') return;

    const { dataUrl, name } = msg.payload || {};
    if (!dataUrl) return;

    state.fileName = name || 'image.png';
    fileNameEl.textContent = state.fileName;

    const img = new Image();
    img.onload = () => {
      state.originalImage = img;
      initCanvasForImage(img);
      state.rectangles = [];
      state.drag = null;
      render();
    };
    img.src = dataUrl;
  });

  canvas.addEventListener('mousedown', (event) => {
    if (!state.originalImage) return;
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
    if (!state.drag) return;
    const p = getCanvasPoint(event);
    state.drag.x2 = p.x;
    state.drag.y2 = p.y;

    const finalRect = clampRectToCanvas(normalizeRect(state.drag));
    state.drag = null;

    if (finalRect.w >= 2 && finalRect.h >= 2) {
      state.rectangles.push({
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
    if (state.rectangles.length > 0) {
      state.rectangles.pop();
      render();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'r') {
      if (state.rectangles.length > 0) {
        state.rectangles.pop();
        render();
      }
    }
    if (event.key === 'Escape') {
      cancelBtn.click();
    }
  });

  cancelBtn.addEventListener('click', () => {
    window.parent.postMessage({ type: 'MOSAIC_EDITOR_CANCEL' }, '*');
  });

  confirmBtn.addEventListener('click', () => {
    if (!state.originalImage) {
      window.parent.postMessage({ type: 'MOSAIC_EDITOR_CANCEL' }, '*');
      return;
    }

    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = state.originalImage.width;
    fullCanvas.height = state.originalImage.height;
    const fctx = fullCanvas.getContext('2d');
    fctx.drawImage(state.originalImage, 0, 0);

    const upscaleFactor = state.displayScale || 1;

    for (const rectRaw of state.rectangles) {
      const rectNorm = normalizeRect(rectRaw);

      const fx = Math.max(0, Math.min(fullCanvas.width, Math.round(rectNorm.x / upscaleFactor)));
      const fy = Math.max(0, Math.min(fullCanvas.height, Math.round(rectNorm.y / upscaleFactor)));
      const fw = Math.max(0, Math.min(fullCanvas.width - fx, Math.round(rectNorm.w / upscaleFactor)));
      const fh = Math.max(0, Math.min(fullCanvas.height - fy, Math.round(rectNorm.h / upscaleFactor)));

      if (fw < 2 || fh < 2) continue;

      const smallW = Math.max(1, Math.floor(fw / state.mosaicSize));
      const smallH = Math.max(1, Math.floor(fh / state.mosaicSize));

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = smallW;
      tempCanvas.height = smallH;
      const tctx = tempCanvas.getContext('2d');

      tctx.imageSmoothingEnabled = true;
      tctx.drawImage(fullCanvas, fx, fy, fw, fh, 0, 0, smallW, smallH);

      fctx.imageSmoothingEnabled = false;
      fctx.drawImage(tempCanvas, 0, 0, smallW, smallH, fx, fy, fw, fh);
      fctx.imageSmoothingEnabled = true;
    }

    fullCanvas.toBlob((blob) => {
      if (!blob) {
        window.parent.postMessage({ type: 'MOSAIC_EDITOR_CANCEL' }, '*');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : '';
        window.parent.postMessage(
          {
            type: 'MOSAIC_EDITOR_CONFIRM',
            payload: {
              blobBase64: base64,
              fileName: state.fileName
            }
          },
          '*'
        );
      };
      reader.readAsDataURL(blob);
    }, 'image/png');
  });
})();
