# NileCart Review System — User & Developer Reference

---

# Part A — User Perspective

*For customers, product managers, business stakeholders, and anyone who does not need code-level detail.*

---

## A.1 What Are Product Reviews?

Product reviews let customers share their experience after buying (or discovering) an item on NileCart. Each review includes:

- A **star rating** (1 to 5 stars)
- An optional **title** and **written comment**
- Optional **photos** (supported by the platform backend)
- A **Verified Purchase** badge when the review is linked to a delivered order

Reviews appear on the **product detail page** and contribute to the product’s **overall rating** shown on listing cards, search results, and category grids.

---

## A.2 Why Reviews Matter

### For everyday shoppers

| Benefit | What it means for you |
|---------|------------------------|
| **Better decisions** | See what other buyers thought before you spend money |
| **Trust signals** | Verified Purchase badges highlight reviews from people who actually received the item |
| **Quick comparison** | Star averages on product cards help you compare options at a glance |
| **Community voice** | Honest feedback helps other shoppers and encourages sellers to maintain quality |

### For business stakeholders

| Benefit | What it means for the business |
|---------|--------------------------------|
| **Conversion** | Products with strong ratings tend to convert better than unrated items |
| **Quality feedback** | Recurring low ratings flag product or fulfillment issues |
| **Seller accountability** | In a multi-vendor marketplace, reviews attach to products and reflect on individual sellers |
| **SEO & discovery** | Review counts and ratings enrich product pages and build buyer confidence |
| **Retention** | Post-purchase review prompts (when implemented) bring customers back to the app |

---

## A.3 Who Can Do What?

| Action | Guest (not logged in) | Logged-in customer |
|--------|----------------------|-------------------|
| Read approved reviews on product pages | Yes | Yes |
| See product average rating & count | Yes | Yes |
| Submit a review | No | Yes (via API; storefront form coming) |
| Delete own review | No | Yes (via API; storefront UI coming) |
| Edit a review after posting | No | Not supported today — delete and re-post would fail (one review per product per user) |

**Sellers and admins** can read reviews on the storefront like any customer. There is **no seller or admin review dashboard** in the current release.

---

## A.4 How to View Reviews (Customer Workflow)

### Step 1 — Browse or search

Find a product through categories, search, wishlist, or recommendations.

### Step 2 — Open the product page

Go to `/product/[product-name]` (e.g. `/product/floral-print-mini-dress`).

### Step 3 — Check the rating summary

Near the product title you will see:

- Average star rating (e.g. **4.2**)
- Total review count (e.g. **(18 reviews)**)

This summary is calculated from **approved** reviews only.

### Step 4 — Scroll to Customer Reviews

Below the product description and purchase options, the **Customer Reviews** section shows:

- Overall rating header (“Based on X reviews”)
- Individual review cards with:
  - Reviewer’s first name initial / display name
  - Star rating (1–5 filled stars)
  - **✓ Verified Purchase** badge (when applicable)
  - Review title and comment text

### Step 5 — Empty state

If no one has reviewed the product yet, you will see:

> **No Reviews Yet** — Be the first customer to review this product.

---

## A.5 How to Submit a Review (Intended Workflow)

> **Current status:** The **backend fully supports** review submission, but the **storefront submit form is not built yet**. The workflow below describes the designed experience and what the API already enforces.

### Intended customer journey

```text
1. Place an order and wait until it is marked "Delivered"
2. Go to Account → Orders (or product page)
3. Tap "Write a review" on a delivered item
4. Choose 1–5 stars, add title/comment (optional photos)
5. Submit → review appears on the product page after approval
```

### Verified Purchase badge

When a customer includes their **order ID** at submission time, NileCart checks:

- The order belongs to the logged-in user
- Order status is **delivered**
- The product appears in that order’s items

If all checks pass, the review is marked **Verified Purchase**. Without a valid order link, the review can still be submitted but will **not** show the verified badge.

### One review per product

Each customer may leave **only one review per product**. Attempting to review the same product twice will be rejected by the system.

---

## A.6 How Reviews Affect Product Ratings

Every time a review is **created** or **deleted**, NileCart recalculates the product’s public rating:

- **Average** — mean of all approved review star ratings (rounded to 1 decimal)
- **Count** — number of approved reviews

These values appear on:

- Product detail page (title area + reviews section)
- Product cards across shop, search, wishlist, and home sections

Only reviews with **`isApproved: true`** count toward the average. Today, new reviews are **auto-approved by default** (see Part B for moderation details).

---

## A.7 Practical Tips for Customers

1. **Read verified reviews first** — they confirm the buyer received the item.
2. **Look at review count** — a 5-star average from 2 reviews is less reliable than from 200.
3. **Check the written comment** — stars alone rarely tell the full story (fit, quality, shipping).
4. **After delivery** — leave a review to help other shoppers (once the submit UI is available).

---

## A.8 Practical Tips for Business & Operations

1. **Monitor low-rated products** — investigate seller fulfillment, sizing, or listing accuracy.
2. **Encourage post-delivery reviews** — email or in-app prompts after `delivered` status (future enhancement).
3. **Plan moderation policy** — today reviews publish immediately; consider admin approval before scaling.
4. **Do not incentivize fake reviews** — undermines trust and may violate marketplace policies.
5. **Use ratings in merchandising** — feature high-rated, well-reviewed products in banners and trending slots.

---

## A.9 What Is Not Available Yet (User-Facing)

| Feature | Status |
|---------|--------|
| Write review button on product page | Not built |
| Write review from Orders page | Not built (Orders page is view-only) |
| Review photo gallery on product page | Backend supports images; UI does not display them |
| “Helpful” / upvote on reviews | Not planned in current codebase |
| Seller replies to reviews | Not available |
| Admin moderation dashboard | Not available |
| Review pagination (“Load more”) on product page | API supports pages; UI loads first page only |

---

---

# Part B — Developer Perspective

*For engineers implementing, integrating, or maintaining the review feature.*

---

## B.1 Architecture Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│  nileCart-next-web (Storefront)                                  │
│                                                                  │
│  product/[slug]/page.js  ──server──► GET /reviews/product/:id   │
│       │                                                          │
│       ▼                                                          │
│  ProductDetailContent → ProductReviewsSection (display only)     │
│                                                                  │
│  reviewService.js        ──client──► GET only (no create UI yet) │
└───────────────────────────────┬──────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  nileCart-server                                                 │
│                                                                  │
│  routes/review.route.js                                          │
│       ├── GET  /reviews/product/:productId  (public)             │
│       ├── POST /reviews                     (protect)            │
│       └── DELETE /reviews/:id               (protect)            │
│                                                                  │
│  controller/review.controller.js                                 │
│       ├── getProductReviews                                      │
│       ├── createReview                                           │
│       ├── deleteReview                                           │
│       └── refreshProductRating → updates Product.rating          │
│                                                                  │
│  models/Review.model.js                                          │
│  models/Product.model.js (rating.average, rating.count)          │
└──────────────────────────────────────────────────────────────────┘
```

**Source of truth files:**

| Layer | Path |
|-------|------|
| Model | `models/Review.model.js` |
| Controller | `controller/review.controller.js` |
| Routes | `routes/review.route.js` |
| Mount | `routes/index.js` → `/reviews` |
| Server-side fetch | `nileCart-next-web/src/lib/data/reviews.js` |
| Client service | `nileCart-next-web/src/services/reviewService.js` |
| Display UI | `nileCart-next-web/src/components/product/ProductReviewsSection.jsx` |
| Product page | `nileCart-next-web/src/app/product/[slug]/page.js` |

---

## B.2 Database Schema

### Review collection (`reviews`)

```javascript
{
  user: ObjectId,           // ref: User — required
  product: ObjectId,      // ref: Product — required
  order: ObjectId,        // ref: Order — optional
  rating: Number,         // required, min 1, max 5
  title: String,          // optional
  comment: String,        // optional, max 1000 chars
  images: [StoredImage],  // optional [{ url, key }]
  isVerifiedPurchase: Boolean,  // default false — set by server logic
  isApproved: Boolean,          // default true — moderation flag
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes

```javascript
{ product: 1, user: 1 }  // UNIQUE — one review per user per product
```

### Product rating (denormalized)

On `Product`:

```javascript
rating: {
  average: Number,  // 0–5, one decimal (e.g. 4.2)
  count: Number     // approved review count
}
```

Updated by `refreshProductRating(productId)` after create/delete.

### StoredImage sub-schema

```javascript
{ url: String, key: String }  // S3 public URL + object key
```

---

## B.3 API Reference

Base path: `/api/reviews`

### B.3.1 `GET /reviews/product/:productId` — Public

List approved reviews for a product.

**Auth:** None

**Query parameters:**

| Param | Default | Max | Description |
|-------|---------|-----|-------------|
| `page` | `1` | — | Page number |
| `limit` | `10` | `30` | Reviews per page |

**Filter:** `{ product: productId, isApproved: true }`

**Sort:** `-createdAt` (newest first)

**Population:** `user` → `name`, `avatar`

**Response transformation:**

- Review `images` → public URLs via `toPublicImageUrls()`
- User `avatar` → public URL via `getImageUrl()`

**Example response:**

```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "_id": "...",
        "user": { "_id": "...", "name": "Jane Doe", "avatar": "https://..." },
        "product": "...",
        "order": "...",
        "rating": 5,
        "title": "Perfect fit!",
        "comment": "True to size and great fabric quality.",
        "images": [],
        "isVerifiedPurchase": true,
        "isApproved": true,
        "createdAt": "2026-06-15T10:30:00.000Z",
        "updatedAt": "2026-06-15T10:30:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 1, "pages": 1 }
  }
}
```

---

### B.3.2 `POST /reviews` — Authenticated

Create a review.

**Auth:** `protect` (JWT required)

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `productId` | ObjectId | Yes | Product being reviewed |
| `rating` | Number | Yes | 1–5 (schema-enforced) |
| `title` | String | No | Short headline |
| `comment` | String | No | Max 1000 characters |
| `orderId` | ObjectId | No | Links review to order for verified badge |
| `images` | StoredImage[] | No | Review photos |

**Validation flow (`createReview`):**

```text
1. Require productId + rating → 400 if missing
2. Product.findById(productId) → 404 if not found (inactive products still found)
3. If orderId provided:
     Order.findOne({
       _id: orderId,
       user: req.user._id,
       orderStatus: "delivered",
       "items.product": productId
     })
     → isVerifiedPurchase = true if match, else false
4. Review.create({ user, product, order, rating, title, comment, images, isVerifiedPurchase })
5. refreshProductRating(productId)
6. Return 201 { review }
```

**Duplicate review:** Unique index `{ product, user }` causes MongoDB duplicate key error if user reviews same product twice — **not caught with a friendly message** in the controller today.

**Moderation:** `isApproved` defaults to `true` — reviews are **live immediately**.

**Example request:**

```http
POST /api/reviews
Authorization: Bearer <token>
Content-Type: application/json

{
  "productId": "507f1f77bcf86cd799439011",
  "rating": 5,
  "title": "Great quality",
  "comment": "Exactly as described. Fast delivery.",
  "orderId": "507f1f77bcf86cd799439012",
  "images": [
    { "url": "https://bucket.s3.region.amazonaws.com/...", "key": "..." }
  ]
}
```

---

### B.3.3 `DELETE /reviews/:id` — Authenticated

Delete the authenticated user’s own review.

**Auth:** `protect`

**Behavior:**

- `Review.findOneAndDelete({ _id, user: req.user._id })`
- 404 if not found or not owned by user
- Calls `refreshProductRating(review.product)` after delete

**No admin delete endpoint** exists today.

---

## B.4 Rating Aggregation Logic

`refreshProductRating(productId)` in `review.controller.js`:

```javascript
// MongoDB aggregation pipeline
{ $match: { product: productId, isApproved: true } }
{ $group: { _id: "$product", average: { $avg: "$rating" }, count: { $sum: 1 } } }

// Result applied to Product:
rating.average = Math.round(average * 10) / 10  // one decimal
rating.count = count || 0
```

**Triggers:**

- After `createReview`
- After `deleteReview`

**Not triggered when:**

- `isApproved` toggled directly in DB (no API for this)
- Product deactivated
- Review updated (no update endpoint exists)

---

## B.5 Moderation Model

| Aspect | Current behavior |
|--------|------------------|
| Default approval | `isApproved: true` on create |
| Public visibility | Only `isApproved: true` in `GET /reviews/product/:id` |
| Admin approve/reject API | **Does not exist** |
| Admin dashboard UI | **Does not exist** |
| Profanity / spam filter | **None** |
| Report review | **Not implemented** |

To manually hide a review today, set `isApproved: false` in MongoDB and run `refreshProductRating` manually (or delete the review document).

---

## B.6 Verified Purchase Logic

```javascript
const order = await Order.findOne({
  _id: orderId,
  user: req.user._id,
  orderStatus: "delivered",
  "items.product": productId,
});
isVerifiedPurchase = !!order;
```

| Condition | `isVerifiedPurchase` |
|-----------|---------------------|
| No `orderId` sent | `false` |
| Order not found / wrong user | `false` |
| Order not `delivered` | `false` |
| Product not in order items | `false` |
| All checks pass | `true` |

**Note:** Review creation is **not blocked** without a valid order — unverified reviews are allowed.

---

## B.7 Frontend Implementation

### B.7.1 Server-side data loading (product page)

`app/product/[slug]/page.js`:

```javascript
const [reviewsData, similarData] = await Promise.all([
  fetchProductReviews(product._id),
  fetchProducts(categoryId ? { category: categoryId } : {}),
]);
reviews = reviewsData?.reviews || [];
```

`lib/data/reviews.js`:

```javascript
serverGet(`/reviews/product/${productId}`, { revalidate: 120 });
```

Reviews are **ISR-cached for 120 seconds** on the Next.js server.

### B.7.2 Display component

`ProductReviewsSection.jsx` — **read-only** presentation:

- Shows `product.rating.average` and `product.rating.count`
- Maps `reviews[]` to cards (name, stars, title, comment, verified badge)
- Does **not** render review `images`
- Does **not** paginate (only first page from server fetch)
- Empty state when `reviews.length === 0`

### B.7.3 Product rating in other UI

| Component | Rating source |
|-----------|---------------|
| `ProductDetailContent` | `product.rating.average`, `product.rating.count` |
| `productCard.jsx` | `product.rating`, `product.ratingCount` from `formatProductCard()` |
| Shop / search grids | Same card formatter |

### B.7.4 Client service (partial)

`services/reviewService.js`:

```javascript
export const getProductReviews = (productId) =>
  apiClient.get(`/reviews/product/${productId}`);
```

**Missing client methods:** `createReview`, `deleteReview` — to be added when submit UI is built.

### B.7.5 React Query keys (prepared)

```javascript
reviews: {
  byProduct: (productId) => ["reviews", productId],
}
```

Ready for client-side review fetching after mutations.

---

## B.8 Intended Frontend Integration (Not Yet Built)

Recommended implementation for review submission:

### Option A — From Orders page (post-delivery)

1. On `OrdersPage`, for `orderStatus === "delivered"`, show **Write review** per line item
2. Open modal with star picker, title, comment, optional image upload
3. `POST /api/reviews` with `{ productId, orderId: order._id, rating, ... }`
4. Invalidate `queryKeys.reviews.byProduct(productId)` and product detail

### Option B — From product page

1. Check if user already reviewed (`GET` reviews and match user, or dedicated `GET /reviews/mine` endpoint)
2. Show form only for logged-in users without existing review
3. Optionally lookup delivered orders containing product for auto `orderId`

### Image uploads for reviews

Review model accepts `images[]`, but:

- No `UPLOAD_FOLDERS.REVIEWS` in `uploadHelpers.js` today
- Add folder constant + presign permission before enabling review photos in UI

---

## B.9 Authentication

All write operations use `protect` middleware:

- Token from HTTP-only cookie `token` or `Authorization: Bearer`
- User must be `isActive: true`

Read (`GET /reviews/product/:productId`) is **public** — no auth required.

---

## B.10 Error Handling Reference

| Scenario | HTTP | Message / behavior |
|----------|------|-------------------|
| Missing `productId` or `rating` on create | 400 | `"productId and rating are required"` |
| Product not found on create | 404 | `"Product not found"` |
| Duplicate review (same user + product) | 500* | Mongo duplicate key error (*should be 409) |
| Delete review not owned / not found | 404 | `"Review not found"` |
| Unauthenticated write | 401 | `"Not authenticated"` |
| Rating out of range | 400** | Mongoose validation error (**if triggered) |

---

## B.11 Business Rules Summary (Technical)

1. **One review per user per product** — unique compound index.
2. **Only approved reviews** are public and count toward product rating.
3. **New reviews auto-approve** (`isApproved: true` default).
4. **Verified purchase** requires `orderId` matching delivered order with product.
5. **Product rating is denormalized** — recalculated on create/delete, not on read.
6. **No update endpoint** — reviews are immutable after creation (delete only).
7. **Comment max length** — 1000 characters (schema).
8. **Rating range** — 1–5 inclusive (schema min/max).
9. **Reviews survive product soft-delete** — orphaned reviews possible if product `isActive: false` (GET product reviews still works by productId).
10. **Guest read, authenticated write.**

---

## B.12 Testing Checklist

### API

- [ ] `GET /reviews/product/:id` returns only `isApproved: true`
- [ ] Pagination respects `page` and `limit` (max 30)
- [ ] `POST /reviews` without auth → 401
- [ ] `POST /reviews` with valid delivered `orderId` → `isVerifiedPurchase: true`
- [ ] `POST /reviews` with undelivered order → `isVerifiedPurchase: false`
- [ ] Second review same user+product → duplicate error
- [ ] `DELETE /reviews/:id` only deletes own review
- [ ] Product `rating.average` and `rating.count` update after create/delete

### Storefront

- [ ] Product page shows rating summary from `product.rating`
- [ ] Reviews section renders review cards
- [ ] Verified badge shows when `isVerifiedPurchase: true`
- [ ] Empty state when no reviews
- [ ] ISR: new review appears within revalidate window (120s) or after rebuild

---

## B.13 Known Gaps & Recommended Improvements

| Gap | Priority | Recommendation |
|-----|----------|----------------|
| No review **submit UI** on storefront | High | Build form on Orders + product page |
| No **update review** endpoint | Medium | `PUT /reviews/:id` or allow upsert |
| Duplicate review → **500** not 409 | Medium | Catch Mongo error code 11000 |
| **Auto-approve** all reviews | Medium | Default `isApproved: false` + admin moderation API |
| No **admin moderation** routes/UI | Medium | `PATCH /admin/reviews/:id/approve` |
| Review **images** not displayed | Low | Gallery in `ProductReviewsSection` |
| No **reviews upload folder** | Low | Add `UPLOAD_FOLDERS.REVIEWS` |
| No **pagination UI** on product page | Low | Load more / infinite scroll |
| No **`GET /reviews/mine`** | Low | Help UI know if user already reviewed |
| **Orders page** copy says “review” but no action | High | Align copy or add review CTA |
| Rating not recalculated on **isApproved** toggle | Low | Hook into moderation approve/reject |
| No **seller response** to reviews | Future | `sellerReply` subdocument on Review |

---

## B.14 Related Documentation

- Product ratings field: `documentation/catalog.documentation.md` (§5.1 Product fields)
- Order lifecycle (delivered status): `controller/order.controller.js`
- HTTP summary: `API.md` (Reviews section)
- User orders UI: `nileCart-next-web/src/views/account/OrdersPage.jsx`

---

*Last updated to reflect the NileCart review implementation across server API and Next.js storefront (display-only UI; submit flow API-ready).*
