# Product Reviews Block

The Product Reviews block renders customer ratings, rating breakdown progress bars, and customer reviews fetched from Adobe Runtime APIs. It also provides an interactive review form for shoppers to submit new product reviews.

## Overview

On Product Detail Pages (PDP), this block is automatically loaded and relocated into the `.product-details__tabs` as the last tab ("Reviews").

## Configuration

The block uses the `product-reviews-api-base` configuration setting from `config.json`:

| Configuration Key | Source | Default Value | Purpose |
|-------------------|--------|---------------|---------|
| `product-reviews-api-base` | `config.json` | `https://748062-106maroongoat-stage.adobeioruntime.net/api/v1/web/product-reviews` | Base URL for Adobe Runtime review microservices |

## APIs Used

### 1. Get Ratings API
- **Endpoint**: `{product-reviews-api-base}/get-ratings?sku={sku}`
- **Method**: `GET`
- **Response Format**:
```json
{
  "success": true,
  "sku": "EXAMPLE-SKU",
  "averageRating": 4.8,
  "reviewCount": 4,
  "reviews": [
    {
      "rating": 5,
      "author": "Jane Doe",
      "title": "Great Product!",
      "review": "Very comfortable and excellent quality.",
      "verified": true
    }
  ]
}
```

### 2. Create Review API
- **Endpoint**: `{product-reviews-api-base}/create-review`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Payload Format**:
```json
{
  "sku": "EXAMPLE-SKU",
  "rating": 5,
  "author": "Jane Doe",
  "title": "Great Product!",
  "review": "Very comfortable and excellent quality."
}
```

## Features & Components

### 1. Rating Summary Section
- **Title**: `Review`
- **Overall Rating**: Displayed as filled gold stars `★★★★★` alongside the total review count (e.g., `4 Reviews`).
- **Rating Breakdown**: Displays progress bars for 5, 4, 3, 2, and 1-star ratings showing star count in blue parentheses `(4)` and percentage fill bars.
- **Action Button**: "WRITE A REVIEW" button that toggles the review submission form.

### 2. Interactive Review Submission Form
- **Form Heading**: `WRITE A REVIEW`
- **Notice**: `* Indicates a required field`
- **Score Rating Picker**: Interactive 5-star rating selector (`☆` unselected outline, `★` selected/hovered filled gold).
- **Title Input**: Full-width required text field for the review title.
- **Review Textarea**: Full-width required multi-line text area for the review body.
- **Author Input**: Optional text field for reviewer name (defaults to "Anonymous" if left blank).
- **Validation**: Requires selecting a star score rating before submission.

### 3. Reviews List Cards
- **Tab Header**: `REVIEWS (count)` with brand gold underline indicator (`#c5a371`).
- **Review Cards**: Enclosed in full-width bordered cards with:
  - Author initial avatar circle.
  - Dynamic `Verified Reviewer` green checkmark badge & label (only rendered when `verified: true` in review item data).
  - Star score rating `★★★★★`.
  - Review title & body text.

## Files

| File | Description |
|------|-------------|
| `product-reviews.js` | Fetches ratings, renders summary/breakdown, manages review form submission, and builds review cards |
| `product-reviews.css` | Styles for rating summary, breakdown bars, interactive star input, write-review form, and list cards |
| `README.md` | Block documentation |

## PDP Tab Integration

The block is dynamically integrated into `.product-details__tabs` via `setupReviewsTabIntegration()` in [`blocks/product-details/product-details.js`](file:///home/anand.parmar@brainvire.com/htdocs/thefutonshop-eds/blocks/product-details/product-details.js).
