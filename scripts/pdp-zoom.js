const GALLERY_IMG_SELECTOR = '.pdp-carousel__slide img, '
  + '.pdp-gallery-grid__item img, .product-details__gallery img';
const THUMB_SELECTOR = '.pdp-carousel__controls--thumbnailsRow, '
  + '.pdp-carousel__controls__container--thumbnailsRow, '
  + '.pdp-carousel__controls__wrapper--thumbnailsRow, '
  + '.pdp-carousel__controls--thumbnailsColumn, '
  + '.pdp-carousel__controls__container--thumbnailsColumn, '
  + '.pdp-carousel__controls__wrapper--thumbnailsColumn, '
  + '.pdp-carousel__thumbnail__container, .pdp-carousel__thumbnail, '
  + '.pdp-carousel__thumbnail__span, [class*="pdp-carousel__thumbnail"], '
  + '[class*="pdp-carousel__controls--thumbnails"]';

/**
 * Calculates transform origin percentages for inline image zoom based on mouse coordinates.
 * @param {{ left: number, top: number, width: number, height: number }} rect
 * @param {number} clientX
 * @param {number} clientY
 * @returns {{ x: number, y: number, xPercent: string, yPercent: string }}
 */
export function calculateZoomOrigin(rect, clientX, clientY) {
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return {
      x: 50,
      y: 50,
      xPercent: '50.00%',
      yPercent: '50.00%',
    };
  }

  const rawX = ((clientX - rect.left) / rect.width) * 100;
  const rawY = ((clientY - rect.top) / rect.height) * 100;

  const clampedX = Math.max(0, Math.min(100, rawX));
  const clampedY = Math.max(0, Math.min(100, rawY));

  return {
    x: clampedX,
    y: clampedY,
    xPercent: `${clampedX.toFixed(2)}%`,
    yPercent: `${clampedY.toFixed(2)}%`,
  };
}

/**
 * Calculates lens position and scroll ratio for side-by-side zoom window.
 * @param {{ left: number, top: number, width: number, height: number }} imgRect
 * @param {number} clientX
 * @param {number} clientY
 * @param {number} [lensWidth]
 * @param {number} [lensHeight]
 * @returns {{ lensX: number, lensY: number, ratioX: number, ratioY: number }}
 */
export function calculateSideZoomPosition(
  imgRect,
  clientX,
  clientY,
  lensWidth = 200,
  lensHeight = 200,
) {
  if (!imgRect || imgRect.width <= 0 || imgRect.height <= 0) {
    return {
      lensX: 0,
      lensY: 0,
      ratioX: 0,
      ratioY: 0,
    };
  }

  const mouseX = clientX - imgRect.left;
  const mouseY = clientY - imgRect.top;

  const maxLensX = Math.max(1, imgRect.width - lensWidth);
  const maxLensY = Math.max(1, imgRect.height - lensHeight);

  const lensX = Math.max(0, Math.min(mouseX - lensWidth / 2, maxLensX));
  const lensY = Math.max(0, Math.min(mouseY - lensHeight / 2, maxLensY));

  const ratioX = maxLensX > 0 ? lensX / maxLensX : 0;
  const ratioY = maxLensY > 0 ? lensY / maxLensY : 0;

  return {
    lensX,
    lensY,
    ratioX,
    ratioY,
  };
}

/**
 * Returns scale transform CSS string for a given scale factor.
 * @param {number} scale
 * @returns {string}
 */
export function getScaleTransform(scale = 2.2) {
  return `scale(${scale})`;
}

/**
 * Applies inline zoom effect on an image element based on cursor position.
 * @param {HTMLElement} img
 * @param {{ left: number, top: number, width: number, height: number }} rect
 * @param {number} clientX
 * @param {number} clientY
 * @param {number} scale
 */
export function applyImageZoom(img, rect, clientX, clientY, scale = 2.2) {
  if (!img) return;
  const origin = calculateZoomOrigin(rect, clientX, clientY);
  img.style.transformOrigin = `${origin.xPercent} ${origin.yPercent}`;
  img.style.transform = getScaleTransform(scale);
  img.style.cursor = 'zoom-in';
}

/**
 * Resets inline image zoom effect.
 * @param {HTMLElement} img
 */
export function resetImageZoom(img) {
  if (!img) return;
  img.style.transform = 'none';
  img.style.transformOrigin = 'center center';
}

/**
 * Opens a full-screen lightbox modal gallery matching the reference design.
 * @param {Element} block
 * @param {number} startIndex
 */
export function openPdpImageOverlay(block, startIndex = 0) {
  if (!block) return;

  const mainImgs = [...block.querySelectorAll('.product-details__left-column .pdp-carousel__slide img, .product-details__gallery .pdp-carousel__slide img, .product-details__gallery img')];
  mainImgs.forEach((img) => resetImageZoom(img));

  const imageSources = [];
  mainImgs.forEach((img) => {
    const src = img.currentSrc || img.src;
    if (src && !imageSources.includes(src) && !img.closest(THUMB_SELECTOR)) {
      imageSources.push(src);
    }
  });

  if (!imageSources.length) return;

  let currentIndex = Math.max(0, Math.min(startIndex, imageSources.length - 1));

  const existingOverlay = document.querySelector('.pdp-overlay');
  if (existingOverlay) existingOverlay.remove();

  const overlay = document.createElement('div');
  overlay.className = 'pdp-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('tabindex', '0');

  const content = document.createElement('div');
  content.className = 'pdp-overlay__content';

  const imageWrapper = document.createElement('div');
  imageWrapper.className = 'pdp-overlay__image-wrapper';

  const modalImg = document.createElement('img');
  modalImg.className = 'pdp-overlay__image';
  modalImg.alt = 'Product Image Overlay';

  imageWrapper.appendChild(modalImg);
  content.appendChild(imageWrapper);

  let prevBtn = null;
  let nextBtn = null;

  if (imageSources.length > 1) {
    prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'pdp-overlay__button pdp-overlay__button--prev';
    prevBtn.setAttribute('aria-label', 'Previous image');
    prevBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'pdp-overlay__button pdp-overlay__button--next';
    nextBtn.setAttribute('aria-label', 'Next image');
    nextBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    content.appendChild(prevBtn);
    content.appendChild(nextBtn);
  }

  const thumbnailsContainer = document.createElement('div');
  thumbnailsContainer.className = 'pdp-overlay__thumbnails-container';

  const thumbnailsList = document.createElement('div');
  thumbnailsList.className = 'pdp-overlay__thumbnails-list';
  thumbnailsContainer.appendChild(thumbnailsList);

  const updateSlide = (newIndex) => {
    currentIndex = (newIndex + imageSources.length) % imageSources.length;
    modalImg.src = imageSources[currentIndex];

    const buttons = thumbnailsList.querySelectorAll('.pdp-overlay__thumbnail-btn');
    buttons.forEach((btn, i) => {
      btn.classList.toggle('pdp-overlay__thumbnail-btn--active', i === currentIndex);
    });
  };

  imageSources.forEach((src, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `pdp-overlay__thumbnail-btn${i === currentIndex ? ' pdp-overlay__thumbnail-btn--active' : ''}`;
    btn.setAttribute('aria-label', `View image ${i + 1}`);

    const thumbImg = document.createElement('img');
    thumbImg.src = src;
    thumbImg.alt = `Thumbnail ${i + 1}`;
    btn.appendChild(thumbImg);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      updateSlide(i);
    });
    thumbnailsList.appendChild(btn);
  });

  content.appendChild(thumbnailsContainer);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'pdp-overlay__close-button';
  closeBtn.setAttribute('aria-label', 'Close dialog');
  closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  overlay.appendChild(content);
  overlay.appendChild(closeBtn);

  let handleKeydown = null;

  const closeOverlay = () => {
    overlay.remove();
    document.scrollingElement.style.overflow = '';
    if (handleKeydown) document.removeEventListener('keydown', handleKeydown);
  };

  handleKeydown = (e) => {
    if (e.key === 'Escape') closeOverlay();
    if (e.key === 'ArrowLeft' && prevBtn) updateSlide(currentIndex - 1);
    if (e.key === 'ArrowRight' && nextBtn) updateSlide(currentIndex + 1);
  };

  if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      updateSlide(currentIndex - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      updateSlide(currentIndex + 1);
    });
  }

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeOverlay();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target === content) closeOverlay();
  });

  document.addEventListener('keydown', handleKeydown);
  document.scrollingElement.style.overflow = 'hidden';

  updateSlide(currentIndex);
  document.body.appendChild(overlay);
  overlay.focus();
}

/**
 * Attaches image magnifier event listeners to PDP gallery containers inside block.
 * Supports side-by-side lens zoom window on viewports >= 1400px.
 * @param {Element} block
 * @param {number} scale
 */
export function initPdpImageMagnifier(block, scale = 2.2) {
  if (!block) return;

  let lensEl = null;
  let previewEl = null;
  let previewImgEl = null;

  const createSideZoomElements = (img) => {
    const parent = img.closest('.pdp-carousel__slide, .pdp-gallery-grid__item') || img.parentElement;
    if (!parent) return;

    if (!lensEl) {
      lensEl = document.createElement('div');
      lensEl.className = 'pdp-zoom-lens';
      parent.appendChild(lensEl);
    } else if (lensEl.parentElement !== parent) {
      parent.appendChild(lensEl);
    }
    lensEl.style.display = 'block';

    const galleryHost = block.querySelector('.product-details__left-column')
      || block.querySelector('.product-details__gallery')
      || block;

    if (!previewEl) {
      previewEl = document.createElement('div');
      previewEl.className = 'pdp-zoom-preview-window';

      previewImgEl = document.createElement('img');
      previewImgEl.className = 'pdp-zoom-preview-img';
      previewEl.appendChild(previewImgEl);

      galleryHost.appendChild(previewEl);
    } else if (previewEl.parentElement !== galleryHost) {
      galleryHost.appendChild(previewEl);
    }

    if (previewImgEl.src !== (img.currentSrc || img.src)) {
      previewImgEl.src = img.currentSrc || img.src;
    }
    previewEl.style.display = 'block';
  };

  const removeSideZoomElements = () => {
    if (lensEl) lensEl.style.display = 'none';
    if (previewEl) previewEl.style.display = 'none';
  };

  const handleMouseMove = (e) => {
    if (document.querySelector('.pdp-overlay')) {
      removeSideZoomElements();
      const allImgs = block.querySelectorAll(GALLERY_IMG_SELECTOR);
      allImgs.forEach((i) => resetImageZoom(i));
      return;
    }

    const { target } = e;

    // Skip thumbnail row images and containers
    if (target.closest(THUMB_SELECTOR)) {
      removeSideZoomElements();
      const allImgs = block.querySelectorAll(GALLERY_IMG_SELECTOR);
      allImgs.forEach((i) => resetImageZoom(i));
      return;
    }

    const slide = target.closest('.pdp-carousel__slide, .pdp-gallery-grid__item');
    const img = target.tagName === 'IMG'
      ? target
      : (target.querySelector('img') || slide?.querySelector('img'));

    if (!img) return;

    const rect = img.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const isLargeScreen = window.innerWidth >= 1400;

    if (isLargeScreen) {
      resetImageZoom(img);
      createSideZoomElements(img);

      const lensWidth = Math.min(220, rect.width * 0.45);
      const lensHeight = Math.min(220, rect.height * 0.45);

      lensEl.style.width = `${lensWidth}px`;
      lensEl.style.height = `${lensHeight}px`;

      const pos = calculateSideZoomPosition(
        rect,
        e.clientX,
        e.clientY,
        lensWidth,
        lensHeight,
      );

      lensEl.style.left = `${pos.lensX}px`;
      lensEl.style.top = `${pos.lensY}px`;

      if (previewImgEl && previewEl) {
        const zoomWidth = rect.width * 2.5;
        const zoomHeight = rect.height * 2.5;

        previewImgEl.style.width = `${zoomWidth}px`;
        previewImgEl.style.height = `${zoomHeight}px`;

        const maxScrollX = Math.max(0, zoomWidth - previewEl.clientWidth);
        const maxScrollY = Math.max(0, zoomHeight - previewEl.clientHeight);

        previewImgEl.style.left = `-${pos.ratioX * maxScrollX}px`;
        previewImgEl.style.top = `-${pos.ratioY * maxScrollY}px`;
      }
    } else {
      removeSideZoomElements();
      if (slide) {
        slide.style.overflow = 'hidden';
      }
      applyImageZoom(img, rect, e.clientX, e.clientY, scale);
    }
  };

  const handleMouseLeave = () => {
    removeSideZoomElements();
    const allImgs = block.querySelectorAll(GALLERY_IMG_SELECTOR);
    allImgs.forEach((i) => resetImageZoom(i));
  };

  const handleClick = (e) => {
    const { target } = e;

    if (
      target.closest(THUMB_SELECTOR)
      || target.closest('.pdp-overlay')
    ) {
      return;
    }

    const mainWrapper = target.closest('.pdp-carousel__wrapper');
    const mainSlide = target.closest('.pdp-carousel__slide, .pdp-gallery-grid__item');
    if (!mainWrapper && !mainSlide) return;

    const clickedImg = target.tagName === 'IMG'
      ? target
      : (target.querySelector('img') || mainSlide?.querySelector('img'));

    removeSideZoomElements();
    const mainImgs = [...block.querySelectorAll(GALLERY_IMG_SELECTOR)];
    mainImgs.forEach((i) => resetImageZoom(i));

    const activeSlide = mainSlide?.closest('.pdp-carousel__wrapper')?.querySelector('.pdp-carousel__slide--active') || mainSlide;
    const activeImg = activeSlide?.querySelector?.('img')
      || (activeSlide?.tagName === 'IMG' ? activeSlide : null);
    const activeSrc = activeImg?.currentSrc
      || activeImg?.src
      || clickedImg?.currentSrc
      || clickedImg?.src;

    const sources = [];
    mainImgs.forEach((i) => {
      const src = i.currentSrc || i.src;
      if (src && !sources.includes(src) && !i.closest(THUMB_SELECTOR)) {
        sources.push(src);
      }
    });

    const index = activeSrc ? sources.indexOf(activeSrc) : 0;
    openPdpImageOverlay(block, index >= 0 ? index : 0);
  };

  const galleries = block.querySelectorAll('.product-details__gallery');
  galleries.forEach((gallery) => {
    gallery.addEventListener('mousemove', handleMouseMove);
    gallery.addEventListener('mouseleave', handleMouseLeave, true);
    gallery.addEventListener('click', handleClick);
  });
}
