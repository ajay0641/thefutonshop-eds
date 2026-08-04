/*
 * Hero Block
 * - Single slide: a static hero (background image + optional heading overlay).
 * - Multiple slides: a full-bleed image carousel of linked promotional banners
 *   (autoplay, prev/next, indicators, swipe). Each authored row is one slide;
 *   a link in the row wraps that slide's image.
 */

const AUTOPLAY_MS = 6000;

function goToSlide(block, index) {
  const slidesWrapper = block.querySelector('.hero-slides');
  const slides = block.querySelectorAll('.hero-slide');
  const total = slides.length;
  let target = index;
  if (target < 0) target = total - 1;
  if (target >= total) target = 0;

  block.dataset.activeSlide = target;
  slidesWrapper.scrollTo({ left: slides[target].offsetLeft, behavior: 'smooth' });

  slides.forEach((slide, i) => {
    slide.setAttribute('aria-hidden', i !== target);
    slide.querySelectorAll('a').forEach((a) => {
      if (i !== target) a.setAttribute('tabindex', '-1');
      else a.removeAttribute('tabindex');
    });
  });

  block.querySelectorAll('.hero-indicator button').forEach((btn, i) => {
    btn.setAttribute('aria-current', i === target ? 'true' : 'false');
  });
}

function bindEvents(block) {
  const slides = block.querySelectorAll('.hero-slide');
  if (slides.length < 2) return;

  block.querySelector('.hero-prev')?.addEventListener('click', () => {
    goToSlide(block, parseInt(block.dataset.activeSlide || '0', 10) - 1);
  });
  block.querySelector('.hero-next')?.addEventListener('click', () => {
    goToSlide(block, parseInt(block.dataset.activeSlide || '0', 10) + 1);
  });
  block.querySelectorAll('.hero-indicator button').forEach((btn, i) => {
    btn.addEventListener('click', () => goToSlide(block, i));
  });

  // Keep the active index in sync when the user swipes/scrolls.
  const slidesWrapper = block.querySelector('.hero-slides');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const i = parseInt(entry.target.dataset.slideIndex, 10);
        block.dataset.activeSlide = i;
        block.querySelectorAll('.hero-indicator button').forEach((btn, idx) => {
          btn.setAttribute('aria-current', idx === i ? 'true' : 'false');
        });
      }
    });
  }, { root: slidesWrapper, threshold: 0.6 });
  slides.forEach((slide) => observer.observe(slide));

  // Autoplay, paused on hover/focus.
  let timer = setInterval(() => {
    goToSlide(block, parseInt(block.dataset.activeSlide || '0', 10) + 1);
  }, AUTOPLAY_MS);
  const stop = () => { clearInterval(timer); timer = null; };
  const start = () => {
    if (!timer) {
      timer = setInterval(() => {
        goToSlide(block, parseInt(block.dataset.activeSlide || '0', 10) + 1);
      }, AUTOPLAY_MS);
    }
  };
  block.addEventListener('mouseenter', stop);
  block.addEventListener('mouseleave', start);
  block.addEventListener('focusin', stop);
  block.addEventListener('focusout', start);
}

/**
 * loads and decorates the hero
 * @param {Element} block The hero block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  // A single row keeps the static hero markup untouched.
  if (rows.length < 2) return;

  // Multiple rows → carousel.
  block.classList.add('hero-carousel');
  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', 'Carousel');

  const slidesWrapper = document.createElement('ul');
  slidesWrapper.className = 'hero-slides';

  rows.forEach((row, index) => {
    const slide = document.createElement('li');
    slide.className = 'hero-slide';
    slide.dataset.slideIndex = index;
    slide.setAttribute('aria-hidden', index !== 0);

    const picture = row.querySelector('picture');
    const anchor = row.querySelector('a');
    let href = anchor?.getAttribute('href');
    if (!href) {
      const text = row.textContent.trim();
      if (/^https?:\/\//.test(text)) href = text;
    }

    if (picture) {
      if (href) {
        const link = document.createElement('a');
        link.href = href;
        link.setAttribute('aria-label', picture.querySelector('img')?.alt || `Slide ${index + 1}`);
        link.append(picture);
        slide.append(link);
      } else {
        slide.append(picture);
      }
    }
    slidesWrapper.append(slide);
    row.remove();
  });

  block.append(slidesWrapper);

  const slideCount = slidesWrapper.children.length;
  if (slideCount > 1) {
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'hero-prev';
    prev.setAttribute('aria-label', 'Previous slide');
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'hero-next';
    next.setAttribute('aria-label', 'Next slide');
    block.append(prev, next);

    const nav = document.createElement('nav');
    nav.className = 'hero-indicators';
    nav.setAttribute('aria-label', 'Carousel Slide Controls');
    for (let i = 0; i < slideCount; i += 1) {
      const item = document.createElement('div');
      item.className = 'hero-indicator';
      item.innerHTML = `<button type="button" aria-label="Show slide ${i + 1} of ${slideCount}" aria-current="${i === 0 ? 'true' : 'false'}"></button>`;
      nav.append(item);
    }
    block.append(nav);
  }

  block.dataset.activeSlide = 0;
  bindEvents(block);
}
