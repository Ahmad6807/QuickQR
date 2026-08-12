/* ================================================================
   QuickQR — app.js
   10,000 character limit · scanner animation · cross-device download
   ================================================================ */

(() => {
  'use strict';

  /* ── DOM ─────────────────────────────────────────────────── */
  const qrInput       = document.getElementById('qr-input');
  const charCounter   = document.getElementById('char-counter');
  const fieldError    = document.getElementById('field-error');
  const fieldWarning  = document.getElementById('field-warning');
  const clearBtn      = document.getElementById('clear-btn');
  const generateBtn   = document.getElementById('generate-btn');
  const downloadBtn   = document.getElementById('download-btn');
  const copyBtn       = document.getElementById('copy-btn');
  const toastContainer= document.getElementById('toast-container');
  const qrCanvas      = document.getElementById('qr-canvas');
  const qrCanvasWrap  = document.getElementById('qr-canvas-wrap');
  const qrPlaceholder = document.getElementById('qr-placeholder');
  const scannerFrame  = document.getElementById('scanner-frame');
  const previewMeta   = document.getElementById('preview-meta');
  const statusChars   = document.getElementById('status-chars');
  const ecLevel       = document.getElementById('ec-level');
  const qrSize        = document.getElementById('qr-size');
  const fgColor       = document.getElementById('fg-color');
  const bgColor       = document.getElementById('bg-color');
  const fgHex         = document.getElementById('fg-hex');
  const bgHex         = document.getElementById('bg-hex');
  const iosHint       = document.getElementById('ios-hint');
  const themeSelect   = document.getElementById('theme-select');

  /* ── Config ──────────────────────────────────────────────── */
  const MAX_CHARS   = 10000;
  const DEBOUNCE_MS = 480;

  /* ── State ───────────────────────────────────────────────── */
  let qrGenerated   = false;
  let debounceTimer = null;
  let qrInstance    = null;
  let ecAutoMode    = true;

  /* ── EC Capacity ─────────────────────────────────────────── */
  const EC_CAPACITY = {
    L: 2953,
    M: 2331,
    Q: 1663,
    H: 1273
  };

  /* ── Platform detection ──────────────────────────────────── */
  /**
   * iOS Safari ignores the `download` attribute on <a href="data:..."> links.
   * Detect it so we can show the long-press hint instead.
   */
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const needsIOSFallback = isIOS && isSafari;

  /* ── EC level map ────────────────────────────────────────── */
  const EC = {
    L: QRCode.CorrectLevel.L,
    M: QRCode.CorrectLevel.M,
    Q: QRCode.CorrectLevel.Q,
    H: QRCode.CorrectLevel.H,
  };

  /* ── Utilities ───────────────────────────────────────────── */
  const isEmpty  = str => str.trim().length === 0;
  const hexLabel = hex => hex.toUpperCase();

  const debounce = fn => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, DEBOUNCE_MS);
  };

  const getOptimalEC = (len) => {
    if (len < 600) return 'H';
    if (len < 1200) return 'Q';
    if (len < 1800) return 'M';
    return 'L';
  };

  const checkCapacityWarning = (len) => {
    const currentEC = ecLevel.value;
    const maxCap = EC_CAPACITY[currentEC];
    
    if (len > maxCap * 0.7) {
      fieldWarning.hidden = false;
      if (currentEC === 'L') {
        fieldWarning.textContent = 'Approaching absolute maximum capacity. Consider shortening your text for a more scannable code.';
      } else {
        fieldWarning.textContent = `Approaching maximum capacity for level ${currentEC}. Consider lowering error correction to keep the QR scannable.`;
      }
    } else {
      fieldWarning.hidden = true;
      fieldWarning.textContent = '';
    }
  };

  const updateCharCounter = () => {
    const len = qrInput.value.length;
    charCounter.textContent = `${len.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`;
    charCounter.classList.toggle('warn',  len > MAX_CHARS * 0.75);
    charCounter.classList.toggle('limit', len >= MAX_CHARS);

    if (ecAutoMode && len > 0) {
      ecLevel.value = getOptimalEC(len);
    }

    checkCapacityWarning(len);
  };

  const setError = msg => {
    fieldError.textContent = msg;
    qrInput.classList.add('is-error');
    qrInput.setAttribute('aria-invalid', 'true');
  };

  const clearError = () => {
    fieldError.textContent = '';
    qrInput.classList.remove('is-error');
    qrInput.removeAttribute('aria-invalid');
  };

  /**
   * Sync hex label text next to the color picker.
   * The swatch color is handled natively by the browser's color input.
   */
  const syncHexLabel = (input, label) => {
    label.textContent = hexLabel(input.value);
  };

  const showToast = (message, isError = false) => {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'toast-error' : ''}`;
    
    const iconSvg = isError 
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    
    toast.innerHTML = `${iconSvg} <span>${message}</span>`;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('toast-hide');
      toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
  };

  /* ── Scanner animation ───────────────────────────────────── */
  /**
   * Adds `.is-scanning` which triggers the fast CSS animation.
   * Listens for animationend on the scanner line, then calls callback.
   *
   * When prefers-reduced-motion is on, the CSS cuts the animation to 0.01ms,
   * so animationend fires almost instantly — the UX degrades gracefully.
   */
  const runScanThenDo = callback => {
    scannerFrame.classList.remove('is-ready');
    scannerFrame.classList.add('is-scanning');

    const scanLine = document.getElementById('scanner-line');

    scanLine.addEventListener('animationend', function handler() {
      scanLine.removeEventListener('animationend', handler);
      scannerFrame.classList.remove('is-scanning');
      callback();
      requestAnimationFrame(() => {
        scannerFrame.classList.add('is-ready');
      });
    });
  };

  /* ── Core: generate ──────────────────────────────────────── */
  const generateQR = () => {
    const text = qrInput.value;

    if (isEmpty(text)) {
      setError('Enter some text or a URL to generate a QR code.');
      return;
    }

    clearError();

    const size  = parseInt(qrSize.value, 10);
    const level = EC[ecLevel.value] ?? QRCode.CorrectLevel.M;
    const fg    = fgColor.value;
    const bg    = bgColor.value;

    generateBtn.disabled = true;

    runScanThenDo(() => {
      renderQR(text, size, level, fg, bg);
      generateBtn.disabled = false;
    });
  };

  /* ── Render: write QR onto canvas ────────────────────────── */
  const renderQR = (text, size, level, fg, bg) => {
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'position:absolute;top:-9999px;left:-9999px;visibility:hidden;';
    document.body.appendChild(tempDiv);

    try {
      if (qrInstance) {
        qrInstance.clear();
        qrInstance = null;
      }

      qrInstance = new QRCode(tempDiv, {
        text,
        width:        size,
        height:       size,
        correctLevel: level,
        colorDark:    fg,
        colorLight:   bg,
      });

      /* qrcodejs renders synchronously then creates a canvas or img element.
         We give the browser one rAF to finish layout before we read it. */
      requestAnimationFrame(() => {
        const innerCanvas = tempDiv.querySelector('canvas');
        const innerImg    = tempDiv.querySelector('img');

        if (innerCanvas) {
          copyCanvasToOutput(innerCanvas, size);
          document.body.removeChild(tempDiv);
          onRenderComplete(text.length);
        } else if (innerImg && innerImg.src) {
          /* IE/older fallback: qrcodejs rendered an <img> instead */
          document.body.removeChild(tempDiv);
          drawImageOnLoad(innerImg.src, size, text.length);
        } else {
          /* One extra tick — rare but happens on some slow mobile browsers */
          setTimeout(() => {
            const c = tempDiv.querySelector('canvas');
            const i = tempDiv.querySelector('img');

            if (document.body.contains(tempDiv)) {
              document.body.removeChild(tempDiv);
            }

            if (c) {
              copyCanvasToOutput(c, size);
              onRenderComplete(text.length);
            } else if (i && i.src) {
              drawImageOnLoad(i.src, size, text.length);
            } else {
              setError('Could not generate. Try shorter text or a lower error-correction level.');
              generateBtn.disabled = false;
            }
          }, 100);
        }
      });

    } catch (err) {
      console.error('[QuickQR] Render error:', err);
      if (document.body.contains(tempDiv)) {
        document.body.removeChild(tempDiv);
      }
      generateBtn.disabled = false;
      setError('Could not generate. Try shorter text or a lower error-correction level.');
    }
  };

  const copyCanvasToOutput = (src, size) => {
    /* Use the source canvas's actual pixel dimensions */
    qrCanvas.width  = src.width  || size;
    qrCanvas.height = src.height || size;
    qrCanvas.getContext('2d').drawImage(src, 0, 0);
  };

  const drawImageOnLoad = (src, size, charCount) => {
    const img = new Image();
    img.onload = () => {
      qrCanvas.width  = size;
      qrCanvas.height = size;
      qrCanvas.getContext('2d').drawImage(img, 0, 0, size, size);
      onRenderComplete(charCount);
    };
    img.onerror = () => {
      setError('Could not load the generated image. Please try again.');
      generateBtn.disabled = false;
    };
    img.src = src;
  };

  const onRenderComplete = charCount => {
    /* Show canvas, hide placeholder */
    qrPlaceholder.hidden = true;
    qrCanvasWrap.hidden  = false;

    /* Replay entrance animation */
    qrCanvasWrap.classList.remove('is-visible');
    void qrCanvasWrap.offsetWidth; /* force reflow */
    qrCanvasWrap.classList.add('is-visible');

    /* Status row */
    previewMeta.hidden = false;
    statusChars.textContent = `· ${charCount.toLocaleString()} char${charCount !== 1 ? 's' : ''}`;

    /* Enable download and copy */
    downloadBtn.disabled = false;
    downloadBtn.setAttribute('aria-disabled', 'false');
    
    if (copyBtn) {
      copyBtn.disabled = false;
      copyBtn.setAttribute('aria-disabled', 'false');
    }

    qrGenerated = true;
  };

  /* ── Download ────────────────────────────────────────────── */
  const downloadQR = () => {
    if (!qrGenerated) return;

    const dataURL  = qrCanvas.toDataURL('image/png');
    const filename = `quickqr-${Date.now()}.png`;

    if (needsIOSFallback) {
      /*
       * iOS Safari ignores <a download> for data: URIs.
       * Show the long-press hint instead so users know to save manually.
       */
      iosHint.hidden = false;
      /* Also open the image in a new tab so they can easily save it */
      const win = window.open();
      if (win) {
        win.document.write(`
          <title>QuickQR — Save your code</title>
          <style>
            body { margin: 0; display: flex; flex-direction: column;
                   align-items: center; justify-content: center;
                   min-height: 100vh; background: #f8f7f5;
                   font-family: -apple-system, sans-serif; gap: 16px; }
            img  { max-width: 90vw; max-height: 80vh;
                   box-shadow: 0 4px 24px rgba(0,0,0,0.12); border-radius: 8px; }
            p    { color: #78716c; font-size: 0.9rem; }
          </style>
          <img src="${dataURL}" alt="Your QR code" />
          <p>Tap and hold the image, then tap <strong>Save Image</strong></p>
        `);
        win.document.close();
      }
      return;
    }

    /* Standard download for Chrome, Firefox, Edge, Desktop Safari */
    const a = document.createElement('a');
    a.href     = dataURL;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    /* Visual confirmation flash */
    downloadBtn.classList.add('did-download');
    setTimeout(() => downloadBtn.classList.remove('did-download'), 1200);
    showToast('Saved to your device');
  };

  /* ── Copy to Clipboard ───────────────────────────────────── */
  const copyToClipboard = async () => {
    if (!qrGenerated) return;

    try {
      qrCanvas.toBlob(async (blob) => {
        try {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          showToast('Copied to clipboard');
        } catch (err) {
          console.error('Clipboard API error:', err);
          showToast('Failed to copy image', true);
        }
      }, 'image/png');
    } catch (err) {
      console.error('Blob error:', err);
      showToast('Failed to copy image', true);
    }
  };

  /* ── Clear ───────────────────────────────────────────────── */
  const clearAll = () => {
    qrInput.value = '';
    ecAutoMode = true;
    updateCharCounter();
    clearError();

    qrPlaceholder.hidden = false;
    qrCanvasWrap.hidden  = true;
    qrCanvasWrap.classList.remove('is-visible');
    previewMeta.hidden   = true;
    iosHint.hidden       = true;

    downloadBtn.disabled = true;
    downloadBtn.setAttribute('aria-disabled', 'true');
    downloadBtn.classList.remove('did-download');
    
    if (copyBtn) {
      copyBtn.disabled = true;
      copyBtn.setAttribute('aria-disabled', 'true');
    }

    scannerFrame.classList.remove('is-ready', 'is-scanning');

    qrGenerated = false;
    qrInstance  = null;

    qrInput.focus();
  };

  /* ── Regenerate when options change ──────────────────────── */
  const onOptionChange = () => {
    if (qrGenerated && !isEmpty(qrInput.value)) generateQR();
  };

  /* ── Event wiring ────────────────────────────────────────── */

  qrInput.addEventListener('input', () => {
    updateCharCounter();
    clearError();
    if (!isEmpty(qrInput.value)) {
      debounce(generateQR);
    }
  });

  /* Ctrl/Cmd + Enter: immediate generate */
  qrInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      clearTimeout(debounceTimer);
      generateQR();
    }
  });

  /* Paste: generate immediately after the paste lands in the field */
  qrInput.addEventListener('paste', () => {
    requestAnimationFrame(() => {
      updateCharCounter();
      if (!isEmpty(qrInput.value)) {
        clearTimeout(debounceTimer);
        generateQR();
      }
    });
  });

  generateBtn.addEventListener('click', () => {
    clearTimeout(debounceTimer);
    generateQR();
  });

  clearBtn.addEventListener('click', clearAll);
  downloadBtn.addEventListener('click', downloadQR);
  if (copyBtn) copyBtn.addEventListener('click', copyToClipboard);

  ecLevel.addEventListener('change', (e) => {
    ecAutoMode = false;
    checkCapacityWarning(qrInput.value.length);
    onOptionChange();
  });
  qrSize.addEventListener('change',  onOptionChange);

  /*
   * Color pickers — the <input type="color"> elements are proper children
   * of their <label for> elements in the HTML, so no JS click delegation
   * is needed. Just listen for changes and update the hex label.
   */
  fgColor.addEventListener('input', () => {
    syncHexLabel(fgColor, fgHex);
    if (qrGenerated) debounce(generateQR);
  });

  bgColor.addEventListener('input', () => {
    syncHexLabel(bgColor, bgHex);
    if (qrGenerated) debounce(generateQR);
  });

  /* ── Init ────────────────────────────────────────────────── */
  updateCharCounter();
  syncHexLabel(fgColor, fgHex);
  syncHexLabel(bgColor, bgHex);

  /* Update download button label for iOS users */
  if (needsIOSFallback) {
    const btnLabel = downloadBtn.querySelector('svg');
    downloadBtn.setAttribute('aria-label', 'View QR code to save (iOS)');
    downloadBtn.childNodes[downloadBtn.childNodes.length - 1].textContent = ' View to Save';
  }

  /* Theme Toggle Setup */
  if (themeSelect) {
    const currentTheme = localStorage.getItem('quickqr-theme') || 'system';
    themeSelect.value = currentTheme;
    themeSelect.addEventListener('change', (e) => {
      const newTheme = e.target.value;
      localStorage.setItem('quickqr-theme', newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
    });
  }

  /* ── Frame Sizing DOM & Logic ────────────────────────────── */
  const frameSizeSlider = document.getElementById('frame-size-slider');
  const frameSizeBadge  = document.getElementById('frame-size-badge');
  const resetSizeBtn    = document.getElementById('reset-size-btn');
  const presetBtns      = document.querySelectorAll('.preset-btn');
  const resizeHandle    = document.getElementById('resize-handle');

  const MIN_FRAME_SIZE     = 160;
  const MAX_FRAME_SIZE     = 520;
  const DEFAULT_FRAME_SIZE = 300;

  /**
   * Sets the scanner frame width & height, updates slider and badge,
   * highlights matching preset buttons, and persists to localStorage.
   */
  const setFrameSize = (size, save = true) => {
    const clampedSize = Math.max(MIN_FRAME_SIZE, Math.min(MAX_FRAME_SIZE, Math.round(size)));

    scannerFrame.style.setProperty('--frame-size', `${clampedSize}px`);

    if (frameSizeSlider) frameSizeSlider.value = clampedSize;
    if (frameSizeBadge)  frameSizeBadge.textContent = `${clampedSize} × ${clampedSize} px`;

    if (presetBtns) {
      presetBtns.forEach(btn => {
        const btnSize = parseInt(btn.dataset.size, 10);
        btn.classList.toggle('active', btnSize === clampedSize);
      });
    }

    if (save) {
      localStorage.setItem('quickqr-frame-size', clampedSize);
    }
  };

  /* Wire up frame sizing slider, presets & reset button */
  if (frameSizeSlider) {
    frameSizeSlider.addEventListener('input', (e) => {
      setFrameSize(parseInt(e.target.value, 10));
    });
  }

  if (presetBtns) {
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const size = parseInt(btn.dataset.size, 10);
        setFrameSize(size);
      });
    });
  }

  if (resetSizeBtn) {
    resetSizeBtn.addEventListener('click', () => {
      setFrameSize(DEFAULT_FRAME_SIZE);
    });
  }

  /* ── Interactive Drag Resizing ────────────────────────────── */
  if (resizeHandle && scannerFrame) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startSize = DEFAULT_FRAME_SIZE;

    const startDrag = (e) => {
      isDragging = true;
      scannerFrame.classList.add('is-resizing');

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      startX = clientX;
      startY = clientY;
      startSize = scannerFrame.offsetWidth || DEFAULT_FRAME_SIZE;

      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('touchmove', handleDrag, { passive: false });
      document.addEventListener('mouseup', stopDrag);
      document.addEventListener('touchend', stopDrag);
      document.addEventListener('touchcancel', stopDrag);
    };

    const handleDrag = (e) => {
      if (!isDragging) return;
      if (e.cancelable) e.preventDefault();

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - startX;
      const deltaY = clientY - startY;
      const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
      const newSize = startSize + delta;

      setFrameSize(newSize, false);
    };

    const stopDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      scannerFrame.classList.remove('is-resizing');

      const currentSize = scannerFrame.offsetWidth || DEFAULT_FRAME_SIZE;
      setFrameSize(currentSize, true);

      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('touchmove', handleDrag);
      document.removeEventListener('mouseup', stopDrag);
      document.removeEventListener('touchend', stopDrag);
      document.removeEventListener('touchcancel', stopDrag);
    };

    resizeHandle.addEventListener('mousedown', startDrag);
    resizeHandle.addEventListener('touchstart', startDrag, { passive: true });

    /* Keyboard control for accessibility */
    resizeHandle.addEventListener('keydown', (e) => {
      const currentSize = scannerFrame.offsetWidth || DEFAULT_FRAME_SIZE;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFrameSize(currentSize + 10);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFrameSize(currentSize - 10);
      }
    });
  }

  /* Load saved frame size on init */
  const savedFrameSize = localStorage.getItem('quickqr-frame-size');
  if (savedFrameSize) {
    setFrameSize(parseInt(savedFrameSize, 10), false);
  }

  qrInput.focus();

})();
