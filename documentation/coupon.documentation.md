# NileCart Coupon System — Business Rules & Technical Reference

## 1. Overview

NileCart supports platform-managed promotional coupons (Myntra-style). Coupons are created by **admins**, validated at checkout, attached to the **cart**, and **redeemed** when an order is placed. Redemption history is tracked in `CouponRedemption`.

**Source of truth files:**

- Model: `models/Coupon.model.js`, `models/CouponRedemption.model.js`
- Business logic: `utils/couponHelpers.js`
- APIs: `controller/coupon.controller.js`, `controller/cart.controller.js`, `controller/order.controller.js`

---

## 2. Roles & Permissions

| Role | Create coupons | Update / deactivate | List all coupons | Validate coupon | Apply to cart | Redeem on order |
|------|----------------|---------------------|------------------|-----------------|---------------|-----------------|
| **Admin** | Yes | Yes | Yes (`GET /admin/coupons`) | Yes | Yes | N/A |
| **Seller** | **No** | **No** | **No** | Yes (as customer) | Yes (as customer) | N/A |
| **Customer** | No | No | Public active only (`GET /coupons/active`) | Yes | Yes | Automatic on checkout |
| **Guest** | No | No | Public active only | Limited validation only | **No** (cart requires login) | No |

### Admin API (protected)

All routes under `/api/admin/coupons` require:

- `protect` — authenticated user
- `authorize("admin")` — admin role only

| Method | Endpoint | Action |
|--------|----------|--------|
| `GET` | `/admin/coupons` | List all coupons |
| `POST` | `/admin/coupons` | Create coupon |
| `PUT` | `/admin/coupons/:id` | Update coupon |
| `PATCH` | `/admin/coupons/:id/status` | Activate / deactivate (`isActive`) |

### Customer / public API

| Method | Endpoint | Auth | Action |
|--------|----------|------|--------|
| `GET` | `/coupons/active` | None | List active platform coupons |
| `POST` | `/coupons/validate` | Optional | Preview discount for a code |
| `POST` | `/cart/coupon` | Required | Apply coupon to cart |
| `DELETE` | `/cart/coupon` | Required | Remove coupon from cart |

### Seller-sponsored coupons (data model vs. current UI)

The `Coupon` model supports `sponsoredBy: "seller"` and a `seller` reference, but:

- Admin dashboard currently creates **platform-only** coupons (`sponsoredBy: "platform"`).
- There is **no seller coupon management API** today.
- Seller-scoped logic exists in `couponHelpers.js` for future seller coupons (discount applies only to that seller's products).

---

## 3. Coupon Fields Reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `code` | String | Yes | — | Unique coupon code. Stored **uppercase**. User input is normalized to uppercase. |
| `description` | String | No | — | Human-readable offer text shown in UI. |
| `discountType` | Enum | Yes | — | `"percentage"` or `"flat"`. |
| `discountValue` | Number | Yes | — | Percentage (e.g. `20` = 20%) or flat amount in ₹ (e.g. `400`). Min `0`. |
| `minOrderAmount` | Number | No | `0` | Minimum **eligible subtotal** (₹) required before discount applies. |
| `maxDiscount` | Number | No | — | **Percentage only.** Caps the discount amount (e.g. 20% off, max ₹500). |
| `usageLimit` | Number | No | — | Global max redemptions across all users. Compared against `usedCount`. |
| `usedCount` | Number | No | `0` | System-managed. Incremented on successful order redemption. |
| `maxUsesPerUser` | Number | No | `1` | Max times one user can redeem this coupon (`CouponRedemption` with `status: "applied"`). |
| `restoreOnCancel` | Boolean | No | `false` | If `true`, cancelling an order restores the coupon usage (`usedCount` decremented, redemption marked `cancelled`). |
| `eligibleUserType` | Enum | No | `"all"` | `"all"`, `"new"`, or `"returning"`. See §4. |
| `sponsoredBy` | Enum | No | `"platform"` | `"platform"` or `"seller"`. |
| `seller` | ObjectId | No | — | Required when seller-sponsored; restricts discount to that seller's products. |
| `applicableCategories` | ObjectId[] | No | `[]` | If set, only products in these categories count toward eligibility. |
| `applicableProducts` | ObjectId[] | No | `[]` | If set, only these products count toward eligibility. |
| `isActive` | Boolean | No | `true` | Admin toggle. Inactive coupons cannot be validated or applied. |
| `startsAt` | Date | No | — | Coupon not valid before this datetime. |
| `endsAt` | Date | No | — | Coupon not valid after this datetime. |
| `createdAt` / `updatedAt` | Date | Auto | — | Mongoose timestamps. |

### Discount calculation

Implemented in `calculateCouponDiscount(coupon, amount)`:

**Percentage (`discountType: "percentage"`):**

```
discount = (eligibleSubtotal × discountValue) / 100
if maxDiscount set → discount = min(discount, maxDiscount)
discount = min(discount, eligibleSubtotal)   // never exceed cart value
```

**Flat (`discountType: "flat"`):**

```
discount = min(discountValue, eligibleSubtotal)
```

**Eligible subtotal** = sum of line totals for cart items that pass product/category/seller rules (see §4.3). `minOrderAmount` is checked against this subtotal, not the full cart if some items are excluded.

---

## 4. Eligibility Rules

### 4.1 Who can apply a coupon?

- User must be **logged in** to apply a coupon to cart (`POST /cart/coupon`).
- Guest users may call `POST /coupons/validate` for a preview, but with **reduced checks** (see §6).
- Coupon must exist, `isActive: true`, and pass all validation in `assertCouponForUser` + cart item rules.

### 4.2 Schedule & lifecycle

| Check | Rule | Error message |
|-------|------|---------------|
| Not started | `startsAt` in the future | `"Coupon not yet active"` |
| Expired | `endsAt` in the past | `"Coupon expired"` |
| Deactivated | `isActive: false` | `"Invalid coupon"` (404 on lookup) |

Public listing (`GET /coupons/active`) additionally filters:

- `sponsoredBy: "platform"`
- `isActive: true`
- Within `startsAt` / `endsAt` window
- `usedCount < usageLimit` (if `usageLimit` is set)

### 4.3 Product / cart eligibility

An item is included in **eligible subtotal** only if:

1. Product is active and variant has sufficient stock.
2. **Seller filter:** if `sponsoredBy === "seller"`, product must belong to `coupon.seller`.
3. **Product whitelist:** if `applicableProducts` is non-empty, product must be in the list.
4. **Category whitelist:** if `applicableCategories` is non-empty, product's category must be in the list.

If eligible subtotal is `0`:

> `"This coupon is not applicable to items in your cart"`

If eligible subtotal < `minOrderAmount`:

> `"Minimum order amount is ₹{minOrderAmount}"`

### 4.4 Global usage limit

```
if usageLimit is set AND usedCount >= usageLimit → reject
```

Message: `"Coupon usage limit reached"`

`usedCount` increments in `recordCouponRedemption` when an order is successfully placed.

### 4.5 Per-user usage limit

Counts `CouponRedemption` documents where:

- `user` = current user
- `coupon` = this coupon
- `status` = `"applied"`

If count ≥ `maxUsesPerUser` (default `1`):

> `"You have already used this coupon"`

### 4.6 New vs returning customers (`eligibleUserType`)

| Value | Meaning (current implementation) |
|-------|----------------------------------|
| `"all"` | Any authenticated user (subject to other rules). |
| `"new"` | User has **zero orders** in the `Order` collection. |
| `"returning"` | User has **one or more orders** (any status). |

**Current behavior in `assertUserEligibility`:**

```js
const orderCount = await Order.countDocuments({ user: userId });
// new       → orderCount must be 0
// returning → orderCount must be > 0
```

**Important notes:**

- Counts **all orders** regardless of `orderStatus` (including `cancelled`, `returned`, and undelivered).
- The local variable is named `deliveredCount` in code but does **not** filter by delivery status.
- `"new"` + `maxUsesPerUser: 1` on a single code blocks reuse of that code.
- Multiple different `"new"` coupons could still be an edge case if not combined with a lifetime welcome flag (future enhancement).

### 4.7 Guest validation (limited)

When `POST /coupons/validate` is called **without** authentication:

- Checks: schedule, global `usageLimit`, `minOrderAmount` vs provided `orderAmount`
- **Does not check:** `eligibleUserType`, `maxUsesPerUser`, product/category scoping
- Full rules apply only when logged in and applying to cart / placing order

---

## 5. End-to-End Lifecycle

### 5.1 Creation (Admin)

```
Admin Dashboard → POST /api/admin/coupons
  → Coupon document created in MongoDB
  → isActive: true by default
```

**Required on create:** `code`, `discountType`, `discountValue`

**Example seed coupons:**

| Code | Type | Value | Min order | User type | Notes |
|------|------|-------|-----------|-----------|-------|
| `SAVANA20` | percentage | 20% | ₹999 | all | max ₹500 discount, 3 uses/user |
| `WELCOME400` | flat | ₹400 | ₹999 | new | 1 use/user, `restoreOnCancel: false` |

### 5.2 Discovery (Customer)

```
GET /api/coupons/active  →  Browse offers on account/coupons page
```

### 5.3 Validation (Preview)

```
POST /api/coupons/validate
Body: { code, orderAmount }
  → assertCouponForUser (if logged in)
  → minOrderAmount check
  → calculateCouponDiscount
  → Returns { coupon, discount }
```

Used by checkout UI before or during apply.

### 5.4 Application (Cart)

```
POST /api/cart/coupon
Body: { code }
  → resolveCouponDiscount(coupon, { userId, items })
       (full assertCouponForUser + cart item eligibility + min order)
  → cart.coupon = coupon._id
  → Returns cart with recalculated totals
```

Cart stores a **reference** to the coupon (`Cart.coupon`). Totals are recalculated on every cart read using `calculateCartTotals`.

**Remove coupon:**

```
DELETE /api/cart/coupon  →  cart.coupon cleared
```

### 5.5 Redemption (Order placement)

```
POST /api/orders
  → buildOrderFromCart()
  → resolveCouponDiscount() re-validates at checkout time
  → Order created with couponCode, discount, total
  → recordCouponRedemption()
       - CouponRedemption created (status: "applied")
       - coupon.usedCount += 1
  → cart cleared (items + coupon removed)
```

Redemption is **final at order placement**, not at cart apply. If coupon becomes invalid between apply and checkout, order placement fails.

### 5.6 Cancellation & restore

When customer cancels an order (`cancelled` status, only from `placed` or `confirmed`):

```
restoreCouponOnCancel(order)
  → If order had couponCode
  → Find CouponRedemption (status: "applied")
  → If coupon.restoreOnCancel === true:
       - redemption.status = "cancelled"
       - coupon.usedCount -= 1
  → If restoreOnCancel === false: no restore (welcome coupons stay consumed)
```

### 5.7 Expiration & deactivation

| Event | Effect |
|-------|--------|
| `endsAt` passed | Validation fails: `"Coupon expired"` |
| Admin sets `isActive: false` | Coupon not found on apply (`isActive: true` filter) |
| `usageLimit` reached | `"Coupon usage limit reached"` |

Existing cart references to a deactivated coupon may fail at checkout recalculation.

---

## 6. Validation Pipeline (`assertCouponForUser`)

Central guard used for logged-in users. Runs in order:

```
1. coupon.isActive        → "Invalid coupon"
2. assertCouponSchedule   → not yet active / expired
3. assertGlobalUsage      → usage limit reached
4. assertPerUserUsage     → user already used this code
5. assertUserEligibility  → new / returning customer rules
```

Cart apply adds:

```
6. assertCouponUsable     → eligible items + minOrderAmount on eligible subtotal
```

---

## 7. Data Models

### CouponRedemption

| Field | Description |
|-------|-------------|
| `user` | Customer who redeemed |
| `coupon` | Coupon reference |
| `order` | Order where applied |
| `status` | `"applied"`, `"cancelled"`, `"refunded"` |
| `discountAmount` | ₹ discount applied |
| `redeemedAt` | Timestamp |

Indexes: `{ user, coupon, status }`, `{ coupon, status }`, `{ order }`

---

## 8. API Quick Reference

### Create coupon (admin)

```http
POST /api/admin/coupons
Authorization: Bearer <admin_token>

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

{ "code": "WELCOME400" }
```

---

## 9. Business Rules Summary

1. **Only admins** create and manage coupons.
2. **One cart = one coupon** at a time (stored on `Cart.coupon`).
3. Discount applies to **eligible items only** when category/product/seller filters are set.
4. **`minOrderAmount`** applies to eligible subtotal, not necessarily entire cart.
5. **Redemption is recorded at order placement**, not at cart apply.
6. **`maxUsesPerUser`** is enforced per coupon code via `CouponRedemption`.
7. **`restoreOnCancel`** controls whether cancellation gives the coupon back.
8. **Welcome / new-user coupons** should use `eligibleUserType: "new"`, `maxUsesPerUser: 1`, and typically `restoreOnCancel: false`.
9. **Guests** get limited validation only; full eligibility requires login.

---

## 10. Known Gaps / Future Improvements

| Gap | Recommendation |
|-----|----------------|
| Seller cannot create own coupons | Add seller-scoped CRUD if marketplace sellers need promos |
| `"new"` based on raw order count | Consider excluding `cancelled`/`returned` or using active-order count |
| Multiple welcome coupons | Add lifetime `welcomeOfferUsedAt` on User |
| Guest validate vs. apply mismatch | Require login before validate, or align guest checks with full rules |
| Cart holds stale coupon | Re-validate on every `getCart` (optional hardening) |
