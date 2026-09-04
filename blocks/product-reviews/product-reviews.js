import { getConfigValue } from '@dropins/tools/lib/aem/configs.js';
import { readBlockConfig } from '../../scripts/aem.js';
import { fetchPlaceholders, getProductSku } from '../../scripts/commerce.js';

function getReviewsApiBase() {
  return getConfigValue('product-reviews-api-base');
}

function getRatingsApiUrl(sku) {
  const base = getReviewsApiBase();
  return `${base}/get-ratings?sku=${encodeURIComponent(sku)}`;
}

function getCreateReviewApiUrl() {
  const base = getReviewsApiBase();
  return `${base}/create-review`;
}

function renderStars(rating = 0) {
  const fullStar = '★';
  const emptyStar = '☆';
  const rounded = Math.round(rating);
  let stars = '';
  for (let i = 1; i <= 5; i += 1) {
    stars += i <= rounded ? fullStar : emptyStar;
  }
  return stars;
}

async function fetchReviews(sku) {
  if (!sku) return null;
  try {
    const response = await fetch(getRatingsApiUrl(sku));
    if (!response.ok) return null;
    const data = await response.json();
    return data.success ? data : null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch product reviews:', err);
    return null;
  }
}

async function submitReview(payload) {
  try {
    const response = await fetch(getCreateReviewApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return data;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to submit product review:', err);
    return { success: false, error: 'Network error submitting review' };
  }
}

/**
 * Decorates product-reviews block
 * @param {Element} block
 */
export default async function decorate(block) {
  const config = readBlockConfig(block);
  block.textContent = '';

  const labels = await fetchPlaceholders();
  let sku = config.sku || getProductSku();

  if (!sku) {
    sku = document.querySelector('meta[name="product-sku"]')?.content
      || document.querySelector('meta[name="sku"]')?.content;
  }

  if (!sku) {
    block.style.display = 'none';
    return;
  }

  const container = document.createElement('div');
  container.className = 'product-reviews-container';

  const loadingEl = document.createElement('div');
  loadingEl.className = 'product-reviews-loading';
  loadingEl.textContent = labels.Global?.LoadingReviews || 'Loading reviews...';
  container.appendChild(loadingEl);
  block.appendChild(container);

  const reviewsData = await fetchReviews(sku);
  loadingEl.remove();

  const avgRating = reviewsData?.averageRating || 0;
  const reviewCount = reviewsData?.reviewCount || 0;
  const reviewsList = reviewsData?.reviews || [];

  function createBreakdownRows(list = []) {
    const total = list.length;
    const breakdownContainer = document.createElement('div');
    breakdownContainer.className = 'product-reviews-breakdown';

    for (let star = 5; star >= 1; star -= 1) {
      const starCount = list.filter((item) => Math.round(item.rating || 5) === star).length;
      const percent = total > 0 ? (starCount / total) * 100 : 0;

      const row = document.createElement('div');
      row.className = 'product-reviews-breakdown-row';

      const starsSpan = document.createElement('span');
      starsSpan.className = 'breakdown-stars';
      starsSpan.innerHTML = `${renderStars(star)} <span class="breakdown-count">(${starCount})</span>`;

      const track = document.createElement('div');
      track.className = 'breakdown-bar-track';

      const fill = document.createElement('div');
      fill.className = 'breakdown-bar-fill';
      fill.style.width = `${percent}%`;

      track.appendChild(fill);
      row.append(starsSpan, track);
      breakdownContainer.appendChild(row);
    }

    return breakdownContainer;
  }

  // Header / Rating Summary
  const summarySection = document.createElement('div');
  summarySection.className = 'product-reviews-summary';

  const heading = document.createElement('h3');
  heading.className = 'product-reviews-title';
  heading.textContent = 'Review';

  const summaryBar = document.createElement('div');
  summaryBar.className = 'product-reviews-summary-bar';

  // Left Column: Stars & Count
  const ratingSummary = document.createElement('div');
  ratingSummary.className = 'product-reviews-summary-rating';

  const starsEl = document.createElement('div');
  starsEl.className = 'product-reviews-stars';
  starsEl.textContent = renderStars(avgRating);

  const countEl = document.createElement('div');
  countEl.className = 'product-reviews-count';
  countEl.textContent = `${reviewCount} ${reviewCount === 1 ? 'Review' : 'Reviews'}`;

  ratingSummary.append(starsEl, countEl);

  // Middle Column: Rating Breakdown
  let breakdownEl = createBreakdownRows(reviewsList);

  // Right Column: Write a Review Button
  const summaryAction = document.createElement('div');
  summaryAction.className = 'product-reviews-summary-action';

  const writeReviewBtn = document.createElement('button');
  writeReviewBtn.type = 'button';
  writeReviewBtn.className = 'product-reviews-write-btn';
  writeReviewBtn.textContent = 'WRITE A REVIEW';

  summaryAction.appendChild(writeReviewBtn);

  summaryBar.append(ratingSummary, breakdownEl, summaryAction);
  summarySection.append(heading, summaryBar);
  container.appendChild(summarySection);

  // Form Container (Toggleable)
  const formContainer = document.createElement('div');
  formContainer.className = 'product-reviews-form-container is-hidden';

  let selectedRating = 0;

  formContainer.innerHTML = `
    <form class="product-reviews-form">
      <h4 class="product-reviews-form-title">WRITE A REVIEW</h4>
      <p class="product-reviews-required-note">
        <span class="required">*</span> Indicates a required field
      </p>
      
      <div class="product-reviews-form-group">
        <label class="product-reviews-label"><span class="required">*</span> Score:</label>
        <div class="product-reviews-star-input" role="radiogroup" aria-label="Score">
          <span class="star-rating-item" data-value="1" role="radio" aria-label="1 star">☆</span>
          <span class="star-rating-item" data-value="2" role="radio" aria-label="2 stars">☆</span>
          <span class="star-rating-item" data-value="3" role="radio" aria-label="3 stars">☆</span>
          <span class="star-rating-item" data-value="4" role="radio" aria-label="4 stars">☆</span>
          <span class="star-rating-item" data-value="5" role="radio" aria-label="5 stars">☆</span>
        </div>
      </div>

      <div class="product-reviews-form-group">
        <label for="review-title-${sku}" class="product-reviews-label"><span class="required">*</span> Title:</label>
        <input type="text" id="review-title-${sku}" class="product-reviews-input" name="title" required />
      </div>

      <div class="product-reviews-form-group">
        <label for="review-body-${sku}" class="product-reviews-label"><span class="required">*</span> Review:</label>
        <textarea id="review-body-${sku}" class="product-reviews-textarea" name="review" rows="5" required></textarea>
      </div>

      <div class="product-reviews-form-group">
        <label for="review-author-${sku}" class="product-reviews-label">Your Name (Optional):</label>
        <input type="text" id="review-author-${sku}" class="product-reviews-input" name="author" placeholder="e.g. Jane Doe" />
      </div>

      <div class="product-reviews-form-actions">
        <button type="submit" class="product-reviews-submit-btn">SUBMIT REVIEW</button>
        <button type="button" class="product-reviews-cancel-btn">CANCEL</button>
      </div>

      <div class="product-reviews-form-msg"></div>
    </form>
  `;

  container.appendChild(formContainer);

  const starItems = formContainer.querySelectorAll('.star-rating-item');
  const starContainer = formContainer.querySelector('.product-reviews-star-input');

  const updateStarInput = (val) => {
    selectedRating = val;
    starItems.forEach((star) => {
      const starVal = Number(star.dataset.value);
      if (starVal <= selectedRating) {
        star.textContent = '★';
        star.classList.add('is-active');
      } else {
        star.textContent = '☆';
        star.classList.remove('is-active');
      }
      star.classList.remove('is-hovered');
    });
  };

  starItems.forEach((star) => {
    star.addEventListener('mouseenter', () => {
      const hoverVal = Number(star.dataset.value);
      starItems.forEach((s) => {
        const val = Number(s.dataset.value);
        s.textContent = val <= hoverVal ? '★' : '☆';
        s.classList.toggle('is-hovered', val <= hoverVal);
      });
    });

    star.addEventListener('click', () => {
      updateStarInput(Number(star.dataset.value));
    });
  });

  if (starContainer) {
    starContainer.addEventListener('mouseleave', () => {
      updateStarInput(selectedRating);
    });
  }

  writeReviewBtn.addEventListener('click', () => {
    formContainer.classList.toggle('is-hidden');
  });

  const cancelBtn = formContainer.querySelector('.product-reviews-cancel-btn');
  cancelBtn.addEventListener('click', () => {
    formContainer.classList.add('is-hidden');
  });

  const form = formContainer.querySelector('form');
  const msgEl = formContainer.querySelector('.product-reviews-form-msg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msgEl.textContent = '';
    msgEl.className = 'product-reviews-form-msg';

    if (selectedRating === 0) {
      msgEl.textContent = 'Please select a rating score before submitting.';
      msgEl.classList.add('is-error');
      return;
    }

    const submitBtn = form.querySelector('.product-reviews-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'SUBMITTING...';

    const authorVal = form.querySelector('[name="author"]').value.trim();
    const titleVal = form.querySelector('[name="title"]').value.trim();
    const reviewVal = form.querySelector('[name="review"]').value.trim();

    const result = await submitReview({
      sku,
      rating: selectedRating,
      author: authorVal || 'Anonymous',
      title: titleVal,
      review: reviewVal,
    });

    submitBtn.disabled = false;
    submitBtn.textContent = 'SUBMIT REVIEW';

    if (result && result.success) {
      msgEl.textContent = 'Thank you! Your review has been submitted successfully.';
      msgEl.classList.add('is-success');
      form.reset();
      updateStarInput(0);
      setTimeout(() => {
        formContainer.classList.add('is-hidden');
        msgEl.textContent = '';
      }, 2500);

      const freshData = await fetchReviews(sku);
      if (freshData) {
        starsEl.textContent = renderStars(freshData.averageRating);
        countEl.textContent = `${freshData.reviewCount} ${freshData.reviewCount === 1 ? 'Review' : 'Reviews'}`;
        const newBreakdown = createBreakdownRows(freshData.reviews || []);
        breakdownEl.replaceWith(newBreakdown);
        breakdownEl = newBreakdown;
        // eslint-disable-next-line no-use-before-define
        renderList(freshData.reviews || []);
      }
    } else {
      msgEl.textContent = result?.error || 'Failed to submit review. Please try again.';
      msgEl.classList.add('is-error');
    }
  });

  const listHeader = document.createElement('div');
  listHeader.className = 'product-reviews-list-header';
  const listTab = document.createElement('div');
  listTab.className = 'product-reviews-list-tab';
  listHeader.appendChild(listTab);

  const listContainer = document.createElement('div');
  listContainer.className = 'product-reviews-list';

  function renderList(list) {
    const count = list ? list.length : 0;
    listTab.innerHTML = `REVIEWS <span class="count">(${count})</span>`;

    listContainer.innerHTML = '';
    if (!list || list.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'product-reviews-empty';
      emptyEl.textContent = 'No reviews yet. Be the first to write a review!';
      listContainer.appendChild(emptyEl);
      return;
    }

    list.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'product-review-item';

      const authorName = item.author || 'Anonymous';
      const initial = authorName.trim().charAt(0).toUpperCase() || 'A';

      const avatarWrap = document.createElement('div');
      avatarWrap.className = 'product-review-avatar-wrap';

      const avatar = document.createElement('div');
      avatar.className = 'product-review-avatar';
      avatar.textContent = initial;

      avatarWrap.append(avatar);

      if (item.verified || item.isVerified) {
        const badge = document.createElement('span');
        badge.className = 'product-review-verified-badge';
        badge.setAttribute('title', 'Verified Reviewer');
        badge.innerHTML = `
          <svg viewBox="0 0 16 16" width="10" height="10" fill="none">
            <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
        avatarWrap.append(badge);
      }

      const content = document.createElement('div');
      content.className = 'product-review-content';

      const authorLine = document.createElement('div');
      authorLine.className = 'product-review-author-line';

      const nameEl = document.createElement('span');
      nameEl.className = 'product-review-author-name';
      nameEl.textContent = authorName;

      authorLine.append(nameEl);

      if (item.verified || item.isVerified) {
        const verifiedLabel = document.createElement('span');
        verifiedLabel.className = 'product-review-verified-label';
        verifiedLabel.textContent = 'Verified Reviewer';
        authorLine.append(verifiedLabel);
      }

      const cardStars = document.createElement('div');
      cardStars.className = 'product-review-item-stars';
      cardStars.textContent = renderStars(item.rating || 5);

      const cardTitle = document.createElement('h5');
      cardTitle.className = 'product-review-item-title';
      cardTitle.textContent = item.title || 'Review';

      const cardBody = document.createElement('p');
      cardBody.className = 'product-review-item-body';
      cardBody.textContent = item.review || '';

      content.append(authorLine, cardStars, cardTitle, cardBody);
      card.append(avatarWrap, content);
      listContainer.appendChild(card);
    });
  }

  renderList(reviewsList);
  container.append(listHeader, listContainer);
}
