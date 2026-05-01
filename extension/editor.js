(() => {
  const MAX_PREVIEW_W = 1200;
  const MAX_PREVIEW_H = 850;
  const CROP_SIZE = 1024;

  const state = {
    images: [],
    currentIndex: 0,
    drag: null,
    mode: 'censor',
    mosaicSize: 15
  };

  const canvas = document.getElementById('previewCanvas');
  const ctx = canvas.getContext('2d');
  const fileNameEl = document.getElementById('fileName');
  const rectCountEl = document.getElementById('rectCount');
  const imageIndexEl = document.getElementById('imageIndex');
  const modeHelpEl = document.getElementById('modeHelp');

  const undoBtn = document.getElementById('undoBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const confirmBtn = document.getElementById('confirmBtn');
  const mosaicSizeInput = document.getElementById('mosaicSizeInput');
  const modeCensorBtn = document.getElementById('modeCensorBtn');
  const modeCropBtn = document.getElementById('modeCropBtn');
  const applyCropBtn = document.getElementById('applyCropBtn');

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

  const getCropSizeDisplay = (imgState) => Math.round(CROP_SIZE * imgState.previewScale);

  const clampCropPreviewPosition = (imgState, x, y) => {
    const size = getCropSizeDisplay(imgState);
    const maxX = Math.max(0, imgState.previewWidth - size);
    const maxY = Math.max(0, imgState.previewHeight - size);
    return {
      x: Math.max(0, Math.min(maxX, x)),
      y: Math.max(0, Math.min(maxY, y))
    };
  };

  const buildCompositedOriginal = (imgState) => {
    const sourceCanvas = imgState.croppedOriginalCanvas || imgState.originalCanvas;
    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = sourceCanvas.width;
    compositeCanvas.height = sourceCanvas.height;
    const compositeCtx = compositeCanvas.getContext('2d');
    compositeCtx.drawImage(sourceCanvas, 0, 0);

    for (const rectRaw of imgState.rectangles) {
      const rect = toOriginalRect(imgState, rectRaw);
      if (rect.w < 2 || rect.h < 2) continue;
      drawMosaicRegion(compositeCtx, rect.x, rect.y, rect.w, rect.h, state.mosaicSize);
    }

    return compositeCanvas;
  };

  const setMode = (mode) => {
    state.mode = mode;
    modeCensorBtn.classList.toggle('mode-btn--active', mode === 'censor');
    modeCropBtn.classList.toggle('mode-btn--active', mode === 'crop');
    applyCropBtn.hidden = mode !== 'crop';
    modeHelpEl.textContent =
      mode === 'crop'
        ? 'Crop mode: drag the red 1024x1024 square and click Apply Crop Preview.'
        : 'Censor mode: click and drag to add a censorship rectangle.';
    render();
  };

  const ensureCropBoxForCurrent = () => {
    const current = getCurrent();
    if (!current) return;

    const size = getCropSizeDisplay(current);
    if (size <= 0 || size > current.previewWidth || size > current.previewHeight) {
      current.cropBox = null;
      return;
    }

    if (!current.cropBox) {
      const centered = clampCropPreviewPosition(
        current,
        Math.round((current.previewWidth - size) / 2),
        Math.round((current.previewHeight - size) / 2)
      );
      current.cropBox = { x: centered.x, y: centered.y };
    } else {
      current.cropBox = clampCropPreviewPosition(current, current.cropBox.x, current.cropBox.y);
    }
  };

  const render = () => {
    const current = getCurrent();
    if (!current) return;

    ensureCropBoxForCurrent();

    canvas.width = current.previewWidth;
    canvas.height = current.previewHeight;

    const compositeOriginal = buildCompositedOriginal(current);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(compositeOriginal, 0, 0, canvas.width, canvas.height);

    if (state.mode === 'crop' && current.cropBox) {
      const size = getCropSizeDisplay(current);
      ctx.save();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(current.cropBox.x, current.cropBox.y, size, size);
      ctx.restore();
    }

    if (state.mode === 'censor' && state.drag) {
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
    applyCropBtn.disabled = state.mode !== 'crop' || !current.cropBox;
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

    const originalCanvas = document.createElement('canvas');
    originalCanvas.width = img.width;
    originalCanvas.height = img.height;
    originalCanvas.getContext('2d').drawImage(img, 0, 0);

    const previewScale = Math.min(1, MAX_PREVIEW_W / originalCanvas.width, MAX_PREVIEW_H / originalCanvas.height);
    const previewWidth = Math.max(1, Math.round(originalCanvas.width * previewScale));
    const previewHeight = Math.max(1, Math.round(originalCanvas.height * previewScale));

    return {
      name: name || 'image.png',
      originalCanvas,
      croppedOriginalCanvas: null,
      previewScale,
      previewWidth,
      previewHeight,
      rectangles: [],
      cropBox: null,
      cropDrag: null
    };
  };

  const switchImage = (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= state.images.length) return;
    state.currentIndex = nextIndex;
    state.drag = null;
    render();
  };

  const applyCropForImage = (imgState) => {
    if (!imgState.cropBox) return;
    const sizeDisplay = getCropSizeDisplay(imgState);
    if (sizeDisplay <= 0) return;

    const x = Math.round(imgState.cropBox.x / imgState.previewScale);
    const y = Math.round(imgState.cropBox.y / imgState.previewScale);

    const cropped = document.createElement('canvas');
    cropped.width = CROP_SIZE;
    cropped.height = CROP_SIZE;
    const cctx = cropped.getContext('2d');

    const source = imgState.originalCanvas;
    if (x + CROP_SIZE > source.width || y + CROP_SIZE > source.height) {
      return;
    }

    cctx.drawImage(source, x, y, CROP_SIZE, CROP_SIZE, 0, 0, CROP_SIZE, CROP_SIZE);
    imgState.croppedOriginalCanvas = cropped;

    imgState.previewScale = Math.min(1, MAX_PREVIEW_W / CROP_SIZE, MAX_PREVIEW_H / CROP_SIZE);
    imgState.previewWidth = Math.max(1, Math.round(CROP_SIZE * imgState.previewScale));
    imgState.previewHeight = Math.max(1, Math.round(CROP_SIZE * imgState.previewScale));
    imgState.rectangles = [];
    imgState.cropBox = null;
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
      setMode('censor');
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

    if (state.mode === 'crop') {
      ensureCropBoxForCurrent();
      if (!current.cropBox) return;
      const size = getCropSizeDisplay(current);
      if (p.x >= current.cropBox.x && p.x <= current.cropBox.x + size && p.y >= current.cropBox.y && p.y <= current.cropBox.y + size) {
        current.cropDrag = { offsetX: p.x - current.cropBox.x, offsetY: p.y - current.cropBox.y };
      }
      return;
    }

    state.drag = { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    render();
  });

  window.addEventListener('mousemove', (event) => {
    const current = getCurrent();
    if (!current) return;

    const p = getCanvasPoint(event);

    if (state.mode === 'crop' && current.cropDrag && current.cropBox) {
      const next = clampCropPreviewPosition(current, p.x - current.cropDrag.offsetX, p.y - current.cropDrag.offsetY);
      current.cropBox.x = next.x;
      current.cropBox.y = next.y;
      render();
      return;
    }

    if (!state.drag || state.mode !== 'censor') return;
    state.drag.x2 = p.x;
    state.drag.y2 = p.y;
    render();
  });

  window.addEventListener('mouseup', (event) => {
    const current = getCurrent();
    if (!current) return;

    const p = getCanvasPoint(event);

    if (state.mode === 'crop') {
      if (current.cropDrag) {
        const next = clampCropPreviewPosition(current, p.x - current.cropDrag.offsetX, p.y - current.cropDrag.offsetY);
        current.cropBox.x = next.x;
        current.cropBox.y = next.y;
      }
      current.cropDrag = null;
      render();
      return;
    }

    if (!state.drag) return;
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
    if (state.mode !== 'censor') return;
    if (current && current.rectangles.length > 0) {
      current.rectangles.pop();
      render();
    }
  });

  modeCensorBtn.addEventListener('click', () => setMode('censor'));
  modeCropBtn.addEventListener('click', () => setMode('crop'));

  applyCropBtn.addEventListener('click', () => {
    const current = getCurrent();
    if (!current || !current.cropBox) return;
    applyCropForImage(current);
    state.mode = 'censor';
    setMode('censor');
    render();
  });

  prevBtn.addEventListener('click', () => switchImage(state.currentIndex - 1));
  nextBtn.addEventListener('click', () => switchImage(state.currentIndex + 1));

  window.addEventListener('keydown', (event) => {
    const current = getCurrent();

    if (event.key.toLowerCase() === 'r' && state.mode === 'censor' && current && current.rectangles.length > 0) {
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

    for (const imgState of state.images) {
      if (imgState.cropBox) {
        applyCropForImage(imgState);
      }
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
