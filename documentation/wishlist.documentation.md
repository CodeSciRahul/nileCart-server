# NileCart Wishlist System — User & Developer Reference

---

# Part A — User Perspective

*For customers, product managers, business stakeholders, and anyone who does not need code-level detail.*

---

## A.1 What Is the Wishlist?

The wishlist is your personal **saved-items list** on NileCart. When you see something you like but are not ready to buy, tap the **heart icon** to save it for later — without adding it to your shopping bag or choosing a size or color.

Think of it as a bookmark for products you want to revisit, compare, or purchase when the time is right.

---

## A.2 Why the Wishlist Matters

### For everyday shoppers

| Benefit | What it means for you |
|---------|------------------------|
| **Save for later** | Heart items while browsing; buy when you are ready |
| **No commitment** | Saving does not require picking a size, color, or quantity |
| **Easy return** | Header badge shows how many items you saved; open **Wishlist** anytime |
| **Cross-device** | Log in on any device — your saved items follow your account |

### For business stakeholders

| Benefit | What it means for the business |
|---------|--------------------------------|
| **Purchase intent** | Wishlist adds signal interest before conversion |
| **Retention** | Saved items give customers a reason to come back |
| **Funnel stage** | Browse → Wishlist → Product page → Bag → Checkout |
| **Merchandising insight** | High wishlist counts could inform trending features (analytics not built yet) |

---

## A.3 Wishlist vs. Shopping Bag

| | Wishlist | Shopping bag |
|---|----------|--------------|
| **Purpose** | Bookmark / shortlist | Ready to purchase |
| **Login required** | Yes | Yes |
| **Size / color needed** | No | Yes |
| **Stock held** | No | Checked at add-to-bag and checkout |
| **Path to checkout** | Open product → choose variant → Add to bag | Go directly to checkout |

The wishlist is intentionally **lighter** than the cart — it saves the product, not a specific purchase configuration.

---

## A.4 Who Can Do What?

| Action | Guest | Logged-in customer | Seller / admin |
|--------|-------|-------------------|----------------|
| View own wishlist | No | Yes | Yes (as customer on storefront) |
| Add / remove items | No — sign in first | Yes | Yes |
| View someone else's wishlist | No | No | No |
| Manage wishlists in dashboard | No | No | No |

There is **no admin or seller wishlist management** — it is a customer-only storefront feature.

---

## A.5 Customer Workflows

### Save a product while browsing

1. Browse home, shop, search, or category pages
2. Tap the **heart** on a product card (top-right corner)
3. **Not logged in?** You are redirected to sign in (`/auth`)
4. **Logged in?** The heart fills amber; a toast confirms "Added to wishlist"
5. The **header badge** on the heart icon updates with your saved count

### Save from the product page

1. Open any product detail page
2. Tap the larger heart button next to **Add To Bag**
3. Same login and toggle behavior as product cards

### View your saved items

1. Tap **Wishlist** (heart icon) in the header
2. You land on `/wishlist` — a grid of saved products
3. Tap any product to open its detail page

### Remove an item

Tap the heart again on any product card (from the wishlist page or anywhere else). The item is removed and the header count decreases.

### Buy a wishlisted item

The wishlist does not checkout directly:

1. Open the product from your wishlist
2. Select your **size / color** (variant)
3. Tap **Add To Bag**
4. Proceed through checkout as usual

### Empty wishlist

If you have no saved items, the page shows a friendly empty state with a **Continue shopping** button.

---

## A.6 Account Deletion

If you delete your account from **Account → Delete Account**, the confirmation warns that wishlists linked to your email will be lost. The account is deactivated; wishlist data may remain in the database but is no longer accessible (see Part B for technical detail).

---

## A.7 What Is Not Available Yet

| Feature | Status |
|---------|--------|
| Save items without logging in (guest wishlist) | Not available |
| "Add all to bag" from wishlist | Not available |
| Save a specific size/color | Product-level only |
| Price-drop or back-in-stock alerts | Not available |
| Wishlist link in account sidebar | Header only today |
| Seller / admin wishlist analytics | Not available |

---

---

# Part B — Developer Perspective

*For engineers implementing, integrating, or maintaining the wishlist feature.*

---

## B.1 Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│  nileCart-next-web (Storefront)                                 │
│  WishlistButton ──► useToggleWishlist ──► POST /wishlist/toggle │
│  WishlistPage   ──► useWishlist       ──► GET  /wishlist        │
│  header.jsx     ──► useWishlist (badge count)                   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  nileCart-server                                                │
│  routes/wishlist.route.js    — all routes use protect           │
│  controller/wishlist.controller.js                              │
│  models/Wishlist.model.js                                       │
│  user.controller.js          — ensureUserSideCollections on login│
└─────────────────────────────────────────────────────────────────┘
```

**Source of truth files:**

| Area | Path |
|------|------|
| Model | `models/Wishlist.model.js` |
| Controller | `controller/wishlist.controller.js` |
| Routes | `routes/wishlist.route.js` |
| Auth bootstrap | `controller/user.controller.js` |
| Service | `nileCart-next-web/src/services/wishlistService.js` |
| Hooks | `nileCart-next-web/src/hooks/useWishlist.js` |
| UI | `components/wishlist/WishlistButton.jsx`, `views/WishlistPage.jsx` |

---

## B.2 Database Schema

### Wishlist collection

```javascript
{
  user: ObjectId,       // ref: User — UNIQUE (one wishlist per user)
  products: [ObjectId], // ref: Product — insertion order, no schema-level unique
  createdAt: Date,
  updatedAt: Date
}
```

| Field | Constraints | Description |
|-------|-------------|-------------|
| `user` | Required, **unique index** | One document per user |
| `products` | Array of ObjectIds | Saved products; duplicates prevented in controller |

### Provisioning

1. **On login** — `ensureUserSideCollections()` upserts `{ products: [] }` alongside cart
2. **Lazy create** — `getOrCreateWishlist()` on first add/toggle

Both paths are idempotent.

### Relationships

```text
User (1) ── (1) Wishlist ── products[] ──► Product (many)
                                              └── isActive: false → filtered from GET
```

---

## B.3 API Reference

Base path: `/api/wishlist`  
**All routes require authentication** (`protect`).

| Method | Endpoint | Body / params | Description |
|--------|----------|---------------|-------------|
| `GET` | `/wishlist` | — | List saved products (active only in response) |
| `POST` | `/wishlist` | `{ productId }` | Add (idempotent) |
| `POST` | `/wishlist/toggle` | `{ productId }` | Add or remove |
| `DELETE` | `/wishlist/:productId` | URL param | Remove explicitly |

### `GET /wishlist`

1. Find wishlist for `req.user._id`
2. Populate `products`
3. Filter `product.isActive === true`
4. Map via `formatProductCard()`
5. Return `{ wishlist, products, count }`

### `POST /wishlist/toggle` (storefront primary)

| State | Action | Response |
|-------|--------|----------|
| Not in list + product active | Add | `201`, `{ inWishlist: true }` |
| In list | Remove | `200`, `{ inWishlist: false }` |
| Product inactive (add path) | Error | `404 Product not found` |

### Error responses

| Status | Condition |
|--------|-----------|
| `401` | Missing / invalid token |
| `403` | Deactivated account |
| `404` | Inactive or missing product (add paths) |

---

## B.4 Controller Logic

### `getOrCreateWishlist(userId)`

Finds existing wishlist or creates `{ user, products: [] }`.

### Duplicate prevention

`addToWishlist` checks `wishlist.products.some(id => id === productId)` before push.

### Inactive product handling

- **Add:** rejected if `!product.isActive`
- **List:** inactive products filtered from response but IDs may remain in DB array

---

## B.5 Frontend Implementation

### Routes

| URL | File |
|-----|------|
| `/wishlist` | `app/wishlist/page.js` → `WishlistPage.jsx` |

Unauthenticated users redirected to `/auth`.

### `WishlistButton`

Used on:

- `components/ui/productCard.jsx` — `variant="overlay"`
- `components/product/ProductInteractive.jsx` — `variant="plain"`

Behavior:

- `stopPropagation()` on card links
- Guest → `/auth`
- Uses `useWishlist()` for heart state (`productIds` Set)
- Uses `useToggleWishlist()` → `POST /wishlist/toggle`
- `aria-label`, `aria-pressed` for accessibility

### React Query

**Query key:** `["wishlist"]`

**`useWishlist`:** enabled when `isAuthenticated && !loading`; selects `{ products, count, productIds }`.

**`useToggleWishlist`:** invalidates on success; redirects on 401.

### Data flow

```text
WishlistButton → toggle mutation → POST /wishlist/toggle
       ↓ invalidate
useWishlist → GET /wishlist → formatProductCard → UI + header badge
```

---

## B.6 Integration with Other Features

| Feature | Integration |
|---------|-------------|
| **Products** | Only active products can be added; deactivated hidden from list |
| **Variants** | Not stored — customer selects at add-to-cart |
| **Cart** | Independent; no move-to-cart automation |
| **Coupons** | Wishlist does not affect coupon eligibility |
| **Orders** | No wishlist data in orders |
| **Auth** | JWT 7-day; wishlist persists server-side after logout |

---

## B.7 API Examples

```http
GET /api/wishlist
Authorization: Bearer <token>
```

```http
POST /api/wishlist/toggle
Authorization: Bearer <token>
Content-Type: application/json

{ "productId": "507f1f77bcf86cd799439011" }
```

```http
DELETE /api/wishlist/507f1f77bcf86cd799439011
Authorization: Bearer <token>
```

---

## B.8 Business Rules Summary (Technical)

1. Login required for all wishlist operations.
2. One wishlist document per user (unique `user` index).
3. Product-level saves only — no variant SKU.
4. No duplicate product IDs in array (controller-enforced).
5. Inactive products cannot be added.
6. Inactive saved products hidden from GET but not auto-pruned.
7. Toggle is the primary storefront mutation.
8. No inventory reservation.
9. Account soft-delete does not purge wishlist documents.

---

## B.9 Testing Checklist

**Storefront:**

- [ ] Guest heart tap → `/auth`
- [ ] Add/remove toggles header badge
- [ ] `/wishlist` grid matches saved items
- [ ] Deactivated product disappears from list
- [ ] Heart on product card does not navigate (stopPropagation)
- [ ] Cross-device persistence after re-login

**API:**

- [ ] `GET /wishlist` without token → 401
- [ ] Invalid productId on toggle → 404
- [ ] Double POST add → single entry
- [ ] DELETE non-existent ID → 200

---

## B.10 React Native Notes

REST API is mobile-ready:

1. Store JWT after auth
2. `GET /api/wishlist` on screen mount
3. `POST /api/wishlist/toggle` on heart tap
4. Cache `productIds` Set locally for instant UI (mirror `useWishlist`)

---

## B.11 Known Gaps & Future Improvements

| Gap | Recommendation |
|-----|----------------|
| No guest wishlist | Merge localStorage hearts on login |
| No `savedAt` per item | Subdocument or separate collection |
| No variant preference | Optional `preferredVariantSku` |
| Stale inactive IDs in array | `$pull` on GET or background job |
| No bulk add-to-cart | Action on wishlist page |
| No analytics | Track add/remove events |
| No price-drop alerts | Notification service |
| Account delete orphan data | Purge wishlist on delete |
| No optimistic UI | Optimistic update in toggle hook |
| Currency ₹ in cards | Localize for UGX launch |

---

## B.12 Related Documentation

- Product catalog: `documentation/catalog.documentation.md`
- Cart & checkout: `controller/cart.controller.js`, `controller/order.controller.js`
- HTTP summary: `API.md`

---

*Last updated to reflect the NileCart wishlist implementation across server API and Next.js storefront.*
