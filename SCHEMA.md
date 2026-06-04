# Saavana E-Commerce — Database Schema

MongoDB + Mongoose. All models live in `backend/models/`.

## Entity relationship overview

```
User ──┬── Cart (1:1)
       ├── Wishlist (1:1)
       ├── Address (1:N)
       ├── Order (1:N)
       └── Review (1:N)

Category ── Product (1:N)
Brand ── Product (1:N, optional)
Product ── Review (1:N)
Coupon ── Cart (optional)
```

---

## 1. User (`User.model.js`)

| Field | Type | Notes |
|-------|------|-------|
| firebaseUid | String | Unique, links Firebase Auth |
| email | String | Unique, sparse |
| mobileNumber | String | Unique, sparse |
| name | String | max 50 |
| birthday | Date | Profile |
| gender | enum | Male, Female, Other |
| categoryPreferences | [String] | Signup preferences |
| avatar | String | URL |
| role | enum | customer, admin |
| isActive | Boolean | default true |

---

## 2. Category (`Category.model.js`)

| Field | Type | Notes |
|-------|------|-------|
| name | String | Display name |
| slug | String | URL key, unique |
| image | String | Category tile |
| parent | ObjectId | Sub-category support |
| displayOrder | Number | Nav sort |
| showInNav | Boolean | Header nav links |
| isActive | Boolean | |

---

## 3. Brand (`Brand.model.js`)

| Field | Type | Notes |
|-------|------|-------|
| name, slug | String | |
| logo | String | |
| isActive | Boolean | |

---

## 4. Product (`Product.model.js`)

| Field | Type | Notes |
|-------|------|-------|
| title, slug, description | String | |
| category | ObjectId → Category | Required |
| brand | ObjectId → Brand | Optional |
| images | [String] | Gallery |
| variants[] | embedded | See below |
| tags | [String] | Search/filter |
| gender | enum | Women, Men, Unisex, Kids |
| discountPercent | Number | Display badge |
| rating.average, rating.count | Number | From reviews |
| isTrending, isNewArrival, isOnSale | Boolean | Home sections |
| isActive | Boolean | |

**Variant (embedded)**

| Field | Type |
|-------|------|
| sku | String |
| size, color, colorHex | String |
| stock | Number |
| price, mrp | Number |
| images | [String] |

---

## 5. Banner (`Banner.model.js`)

Hero carousel: title, subtitle, description, image, ctaText, ctaLink, displayOrder, schedule (startsAt/endsAt).

---

## 6. Announcement (`Announcement.model.js`)

Top promo bar: message, icon, link, priority, schedule.

---

## 7. Address (`Address.model.js`)

Shipping addresses per user: fullName, mobileNumber, pincode, addressLine, locality, city, state, country, addressType, isDefault.

---

## 8. Cart (`Cart.model.js`)

One cart per user.

**Cart item:** product, variantId, quantity.

Optional `coupon` reference.

---

## 9. Wishlist (`Wishlist.model.js`)

One wishlist per user; `products[]` → Product IDs.

---

## 10. Coupon (`Coupon.model.js`)

| Field | Notes |
|-------|-------|
| code | Unique, uppercase |
| discountType | percentage \| flat |
| discountValue | Amount or % |
| minOrderAmount | Eligibility |
| maxDiscount | Cap for % coupons |
| usageLimit, usedCount | |

---

## 11. Order (`Order.model.js`)

| Field | Notes |
|-------|-------|
| orderNumber | e.g. SAV-XXX |
| items[] | Snapshot: title, size, color, price, qty |
| shippingAddress | Embedded snapshot |
| paymentMethod | cod, upi, card, wallet |
| paymentStatus | pending, paid, failed, refunded |
| orderStatus | placed → delivered / cancelled |
| subtotal, discount, shippingFee, total | |
| statusHistory[] | Audit trail |

---

## 12. Review (`Review.model.js`)

One review per user per product (unique index). rating 1–5, title, comment, images, isVerifiedPurchase, isApproved.

---

## Indexes

- Product: text index on title, tags, description; category + isActive; isTrending
- Review: unique (product + user)
