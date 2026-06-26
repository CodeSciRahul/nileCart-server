# NileCart Coupon System — User & Developer Reference

---

# Part A — User Perspective

*For customers, product managers, business stakeholders, and anyone who does not need code-level detail.*

---

## A.1 What Are Coupons?

Coupons are promotional discount codes that customers enter at checkout to save money on their order. NileCart supports **platform-managed coupons** (Myntra-style): the **platform admin** creates offers, customers discover and apply them while shopping, and the discount is applied when the order is placed.

Each coupon can offer:

- A **percentage off** (e.g. 20% off, capped at a maximum amount)
- A **flat amount off** (e.g. ₹400 off)
- Rules such as minimum order value, new-customer-only, usage limits, and expiry dates

---

## A.2 Why Coupons Matter

### For everyday shoppers

| Benefit | What it means for you |
|---------|------------------------|
| **Save money** | Enter a code at checkout to reduce your order total |
| **Discover offers** | Browse active coupons under Account → Coupons |
| **Try the platform** | Welcome codes (e.g. first-order discounts) lower the barrier to first purchase |
| **Transparency** | The bag and payment pages show the discount before you place the order |

### For business stakeholders

| Benefit | What it means for the business |
|---------|--------------------------------|
| **Acquisition** | New-user coupons drive first orders |
| **Conversion** | Cart abandonment drops when a relevant offer is visible |
| **Campaign control** | Admins set start/end dates, usage caps, and eligibility rules |
| **Margin protection** | Minimum order amounts, max discount caps, and category scoping limit exposure |
| **Audit trail** | Every redemption is recorded when an order is placed |

---

## A.3 Who Can Do What?

| Action | Admin | Seller | Customer | Guest |
|--------|-------|--------|----------|-------|
| Create / edit / deactivate coupons | Yes | No | No | No |
| View all coupons (including inactive) | Yes | No | No | No |
| Browse active public coupons | Yes | Yes | Yes | Yes |
| Preview / validate a code | Yes | Yes | Yes | Limited preview only |
| Apply coupon to bag | Yes | Yes | Yes | **No** (login required) |
| Redeem on order | N/A | N/A | Automatic at checkout | No |

**Note:** Sellers can use coupons as customers on the storefront but **cannot create their own** coupon campaigns in the dashboard today (the data model supports seller-sponsored coupons for future use).

---

## A.4 Customer Workflows

### Browse available offers

1. Log in to the storefront
2. Go to **Account → Coupons** (`/account/coupons`)
3. See active platform offers with codes, descriptions, and discount details
4. Tap **Copy** to copy a code to your clipboard

### Apply a coupon while shopping

1. Add items to your **bag** (`/checkout/bag`)
2. In the **Coupon** section, enter your code
3. Tap **Apply** — the system validates the code against your cart
4. If valid, the bag total updates with the discount shown
5. Proceed to **Payment** — the same coupon carries through if still valid

You can **remove** an applied coupon from the bag before checkout.

### What happens at checkout

When you place an order:

- The coupon is **re-validated** one last time (stock, eligibility, expiry)
- The discount is locked into the order total
- The coupon usage is **recorded** — global and per-user limits are updated
- Your bag is cleared, including the applied coupon

If the coupon becomes invalid between applying and checkout (expired, usage limit reached), order placement will fail with an error message.

### Order cancellation and coupons

Some coupons can be **restored** if you cancel an order early (status `placed` or `confirmed`). Whether you get the coupon back depends on how the admin configured the coupon:

- **`restoreOnCancel: true`** — coupon usage is returned; you can use it again
- **`restoreOnCancel: false`** — typical for welcome/first-order offers; coupon stays used

---

## A.5 Coupon Rules Shoppers Should Know

| Rule | Plain-language explanation |
|------|---------------------------|
| **One coupon per bag** | You can only apply one code at a time |
| **Login required** | Guests cannot apply coupons to a cart |
| **Minimum order** | Your eligible items must meet the minimum subtotal (not always the full bag if some items are excluded) |
| **Category / product limits** | Some codes only apply to certain categories or products |
| **New vs returning** | Some codes are for first-time buyers only; others for returning customers |
| **Usage limits** | A code may run out globally or be limited to one use per customer |
| **Schedule** | Codes only work between their start and end dates |

---

## A.6 Admin Workflows (Business / Operations)

### Create a new coupon

1. Log in to **Admin Dashboard** → **Coupons** → **Create Coupon**
2. Set code, discount type (percentage or flat), value, and description
3. Configure rules: minimum order, max discount cap, user type, usage limits, dates
4. Save — coupon is active immediately unless you set a future `startsAt`

### Example campaign ideas

| Campaign | Suggested settings |
|----------|-------------------|
| Welcome offer | `eligibleUserType: new`, `maxUsesPerUser: 1`, `restoreOnCancel: false` |
| Season sale | Percentage off, `minOrderAmount`, `endsAt` date |
| Category push | Restrict to `applicableCategories` for a specific department |

### Deactivate a coupon

From **All Coupons**, toggle status to inactive — the code stops working immediately for new applications. Carts with an already-applied inactive coupon may fail at checkout.

---

## A.7 What Is Not Available Yet

| Feature | Status |
|---------|--------|
| Seller-created coupons in dashboard | Data model ready; no seller UI or API |
| Multiple coupons on one order | Not supported — one per cart |
| Auto-apply best coupon | Not implemented |
| Coupon stacking with other promotions | Not implemented |
| Guest coupon apply | Not supported |

---

---

# Part B — Developer Perspective

*For engineers implementing, integrating, or maintaining the coupon feature.*

---

## B.1 Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│  nileCart-dashboard (Admin)                                     │
│  CouponsList / CouponForm → POST/PUT/PATCH /api/admin/coupons   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────┴─────────────────────────────────┐
│  nileCart-next-web (Storefront)                                 │
│  CouponsPage        → GET /coupons/active                       │
│  CouponInput (bag)  → POST /coupons/validate, POST /cart/coupon │
│  PaymentPage        → cart totals include coupon discount       │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  nileCart-server                                                │
│  coupon.controller.js   — CRUD, validate, active list           │
│  cart.controller.js     — apply / remove coupon on cart         │
│  order.controller.js    — redeem + restore on cancel            │
│  couponHelpers.js       — eligibility, discount math, redemption│
│  models: Coupon, CouponRedemption, Cart                         │
└─────────────────────────────────────────────────────────────────┘
```

**Source of truth files:**

| Area | Path |
|------|------|
| Models | `models/Coupon.model.js`, `models/CouponRedemption.model.js`, `models/Cart.model.js` |
| Business logic | `utils/couponHelpers.js` |
| Controllers | `controller/coupon.controller.js`, `controller/cart.controller.js`, `controller/order.controller.js` |
| Admin routes | `routes/admin.route.js` (coupon routes) |
| Public routes | `routes/coupon.route.js`, `routes/cart.route.js` |
| Admin UI | `nileCart-dashboard/src/pages/admin/CouponsList.jsx`, `CouponFormPage.jsx` |
| Storefront UI | `nileCart-next-web/src/components/checkout/CouponInput.jsx`, `views/account/CouponsPage.jsx` |

---

## B.2 Database Schema

### Coupon

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `code` | String | Yes | — | Unique, stored **uppercase** |
| `description` | String | No | — | UI display text |
| `discountType` | Enum | Yes | — | `"percentage"` or `"flat"` |
| `discountValue` | Number | Yes | — | % or flat ₹ amount |
| `minOrderAmount` | Number | No | `0` | Min **eligible subtotal** |
| `maxDiscount` | Number | No | — | Percentage only — cap on discount ₹ |
| `usageLimit` | Number | No | — | Global max redemptions |
| `usedCount` | Number | No | `0` | System-managed |
| `maxUsesPerUser` | Number | No | `1` | Per-user redemption cap |
| `restoreOnCancel` | Boolean | No | `false` | Restore usage on order cancel |
| `eligibleUserType` | Enum | No | `"all"` | `"all"`, `"new"`, `"returning"` |
| `sponsoredBy` | Enum | No | `"platform"` | `"platform"` or `"seller"` |
| `seller` | ObjectId | No | — | Required when seller-sponsored |
| `applicableCategories` | ObjectId[] | No | `[]` | Whitelist categories |
| `applicableProducts` | ObjectId[] | No | `[]` | Whitelist products |
| `isActive` | Boolean | No | `true` | Admin toggle |
| `startsAt` / `endsAt` | Date | No | — | Schedule window |

### CouponRedemption

| Field | Type | Description |
|-------|------|-------------|
| `user` | ObjectId | Customer |
| `coupon` | ObjectId | Coupon reference |
| `order` | ObjectId | Order where applied |
| `status` | Enum | `"applied"`, `"cancelled"`, `"refunded"` |
| `discountAmount` | Number | ₹ applied |
| `redeemedAt` | Date | Timestamp |

**Indexes:** `{ user, coupon, status }`, `{ coupon, status }`, `{ order }`

### Cart (coupon reference)

`Cart.coupon` — ObjectId ref to applied coupon (one at a time).

---

## B.3 Discount Calculation

Implemented in `calculateCouponDiscount(coupon, amount)`:

**Percentage:**

```
discount = (eligibleSubtotal × discountValue) / 100
if maxDiscount → discount = min(discount, maxDiscount)
discount = min(discount, eligibleSubtotal)
```

**Flat:**

```
discount = min(discountValue, eligibleSubtotal)
```

**Eligible subtotal** = sum of line totals for cart items passing product/category/seller filters. `minOrderAmount` checked against this subtotal.

---

## B.4 API Reference

### Admin — `/api/admin/coupons`

Requires `protect` + `authorize("admin")`.

| Method | Endpoint | Action |
|--------|----------|--------|
| `GET` | `/admin/coupons` | List all coupons |
| `POST` | `/admin/coupons` | Create coupon |
| `PUT` | `/admin/coupons/:id` | Update coupon |
| `PATCH` | `/admin/coupons/:id/status` | Toggle `isActive` |

### Public / customer — `/api/coupons`

| Method | Endpoint | Auth | Action |
|--------|----------|------|--------|
| `GET` | `/coupons/active` | None | Active platform coupons (filtered) |
| `POST` | `/coupons/validate` | Optional | Preview discount |

### Cart — `/api/cart`

| Method | Endpoint | Auth | Body |
|--------|----------|------|------|
| `POST` | `/cart/coupon` | Required | `{ code }` |
| `DELETE` | `/cart/coupon` | Required | — |

### Order redemption

`POST /api/orders` → `buildOrderFromCart()` → `recordCouponRedemption()` on success.

---

## B.5 Validation Pipeline

### `assertCouponForUser` (logged-in users)

```text
1. coupon.isActive        → "Invalid coupon"
2. assertCouponSchedule   → not yet active / expired
3. assertGlobalUsage      → usage limit reached
4. assertPerUserUsage     → user already used this code
5. assertUserEligibility  → new / returning customer rules
```

Cart apply adds:

```text
6. assertCouponUsable     → eligible items + minOrderAmount
```

### Cart item eligibility

An item counts toward eligible subtotal only if:

1. Product is active with sufficient variant stock
2. **Seller filter:** if `sponsoredBy === "seller"`, product belongs to `coupon.seller`
3. **Product whitelist:** if `applicableProducts` set, product must be listed
4. **Category whitelist:** if `applicableCategories` set, product category must match

### New vs returning (`eligibleUserType`)

| Value | Rule (current implementation) |
|-------|-------------------------------|
| `"all"` | Any authenticated user |
| `"new"` | User has **zero** orders in `Order` collection |
| `"returning"` | User has **one or more** orders |

**Caveat:** Counts all orders regardless of status (including cancelled). Variable named `deliveredCount` in code but does not filter by delivery.

### Guest validation (limited)

`POST /coupons/validate` without auth checks schedule, global limit, and `minOrderAmount` vs provided `orderAmount` only — **not** user type, per-user limit, or product scoping.

---

## B.6 End-to-End Lifecycle

```text
Admin creates coupon (POST /admin/coupons)
    ↓
Customer discovers (GET /coupons/active) or enters code manually
    ↓
Preview (POST /coupons/validate) — optional
    ↓
Apply to cart (POST /cart/coupon) → Cart.coupon set, totals recalculated
    ↓
Place order (POST /orders) → re-validate → recordCouponRedemption
    ↓
Cancel order (early stages) → restoreCouponOnCancel if restoreOnCancel: true
```

Redemption is **final at order placement**, not at cart apply.

---

## B.7 Frontend Implementation

### Admin dashboard

| Route | Component |
|-------|-----------|
| `/admin/coupons` | `CouponsList` + `CouponCatalog` |
| `/admin/coupons/new` | `AdminCouponForm` |
| `/admin/coupons/:id/edit` | `AdminCouponForm` |

### Storefront

| File | Behavior |
|------|----------|
| `views/account/CouponsPage.jsx` | Lists active coupons via `useActiveCoupons()` |
| `components/checkout/CouponInput.jsx` | Apply/remove on bag and payment pages |
| `hooks/useCoupon.js` | Mutations for apply, remove, validate |

`CouponInput` validates on apply and shows success/error preview messages.

---

## B.8 Cancellation & Restore

`restoreCouponOnCancel(order)` when customer cancels from `placed` or `confirmed`:

- Finds `CouponRedemption` with `status: "applied"`
- If `coupon.restoreOnCancel === true`: marks redemption `cancelled`, decrements `usedCount`
- If `false`: no restore (welcome coupons stay consumed)

---

## B.9 API Examples

### Create coupon (admin)

```http
POST /api/admin/coupons
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "code": "WELCOME400",
  "description": "Flat ₹400 off on your first order above ₹999",
  "discountType": "flat",
  "discountValue": 400,
  "minOrderAmount": 999,
  "maxUsesPerUser": 1,
  "eligibleUserType": "new",
  "restoreOnCancel": false,
  "sponsoredBy": "platform",
  "usageLimit": 1000,
  "startsAt": "2026-01-01T00:00:00.000Z",
  "endsAt": "2026-12-31T23:59:59.000Z"
}
```

### Apply to cart (customer)

```http
POST /api/cart/coupon
Authorization: Bearer <customer_token>
Content-Type: application/json

{ "code": "WELCOME400" }
```

---

## B.10 Business Rules Summary (Technical)

1. **Only admins** create and manage coupons.
2. **One cart = one coupon** (`Cart.coupon` reference).
3. Discount applies to **eligible items only** when filters are set.
4. **`minOrderAmount`** applies to eligible subtotal.
5. **Redemption at order placement**, not cart apply.
6. **`maxUsesPerUser`** enforced via `CouponRedemption`.
7. **`restoreOnCancel`** controls cancellation restore behavior.
8. **Guests** get limited validation only.

---

## B.11 Testing Checklist

- [ ] Admin create / update / deactivate coupon
- [ ] `GET /coupons/active` excludes inactive, expired, exhausted
- [ ] Apply valid coupon → cart discount updates
- [ ] Apply invalid code → clear error message
- [ ] New-user coupon rejected for returning customer
- [ ] Category-scoped coupon ignores ineligible items
- [ ] Order placement records redemption and increments `usedCount`
- [ ] Cancel with `restoreOnCancel: true` restores usage
- [ ] Guest validate vs logged-in apply behavior difference

---

## B.12 Known Gaps & Future Improvements

| Gap | Recommendation |
|-----|----------------|
| Seller cannot create own coupons | Add seller-scoped CRUD |
| `"new"` based on raw order count | Exclude cancelled/returned orders |
| Multiple welcome coupons edge case | Lifetime `welcomeOfferUsedAt` on User |
| Guest validate vs apply mismatch | Align checks or require login before validate |
| Stale coupon on cart | Re-validate on every `getCart` |
| Seller-sponsored UI | Wire `sponsoredBy: "seller"` in admin/seller dashboard |

---

## B.13 Related Documentation

- Catalog (category/product coupon scoping): `documentation/catalog.documentation.md`
- HTTP summary: `API.md`
- Seed examples: `scripts/seed.js` (`SAVANA20`, `WELCOME400`)

---

*Last updated to reflect the NileCart coupon implementation across admin dashboard, server API, and Next.js storefront.*
