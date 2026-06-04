# Saavana API Reference

Base URL: `http://localhost:5000/api`

All responses: `{ success: true|false, ... }`

Auth: Firebase ID token → `POST /auth/login` → JWT in httpOnly cookie or `Authorization: Bearer <token>`.

---

## Auth & User

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | — | Body: `{ token }` Firebase ID token |
| POST | `/auth/logout` | — | Clear cookie |
| GET | `/users/me` | ✓ | Get profile |
| PUT | `/users/me` | ✓ | Update profile (name, gender, birthday, categoryPreferences, mobileNumber) |

---

## Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/categories?navOnly=true` | List categories |
| GET | `/categories/:slug` | Category detail |
| POST | `/categories` | Create (auth) |

---

## Products

| Method | Endpoint | Query params |
|--------|----------|--------------|
| GET | `/products` | `page`, `limit`, `category`, `brand`, `gender`, `minPrice`, `maxPrice`, `isTrending`, `isOnSale`, `search`, `sort` |
| GET | `/products/trending` | `limit` |
| GET | `/products/search?q=` | Search |
| GET | `/products/:slug` | Product detail + variants |
| POST | `/products` | Create (auth) |

---

## Banners & Announcements

| Method | Endpoint |
|--------|----------|
| GET | `/banners` |
| GET | `/banners/announcements` |

---

## Cart

| Method | Endpoint | Body |
|--------|----------|------|
| GET | `/cart` | — |
| POST | `/cart/items` | `{ productId, variantId, quantity }` |
| PUT | `/cart/items/:itemId` | `{ quantity }` |
| DELETE | `/cart/items/:itemId` | — |
| DELETE | `/cart` | Clear |
| POST | `/cart/coupon` | `{ code }` |

---

## Wishlist

| Method | Endpoint |
|--------|----------|
| GET | `/wishlist` |
| POST | `/wishlist` | `{ productId }` |
| POST | `/wishlist/toggle` | `{ productId }` |
| DELETE | `/wishlist/:productId` |

---

## Addresses

| Method | Endpoint |
|--------|----------|
| GET | `/addresses` |
| POST | `/addresses` |
| PUT | `/addresses/:id` |
| DELETE | `/addresses/:id` |
| PATCH | `/addresses/:id/default` |

---

## Orders

| Method | Endpoint | Body |
|--------|----------|------|
| GET | `/orders/summary` | Free shipping info |
| POST | `/orders` | `{ addressId, paymentMethod }` |
| GET | `/orders?status=&page=` | My orders |
| GET | `/orders/:id` | Order detail |
| PATCH | `/orders/:id/cancel` | `{ reason }` |

---

## Coupons

| Method | Endpoint | Body |
|--------|----------|------|
| POST | `/coupons/validate` | `{ code, orderAmount }` |

---

## Reviews

| Method | Endpoint |
|--------|----------|
| GET | `/reviews/product/:productId` |
| POST | `/reviews` | `{ productId, rating, title, comment, orderId? }` |
| DELETE | `/reviews/:id` |

---

## Health

`GET /api/health`

---

## Setup

```bash
cd backend
cp .env.example .env
# Set MONGODB_URI, JWT_SECRET, Firebase credentials
npm install
npm run seed
npm run dev
```

Frontend login (uncomment in `login.jsx`):

```js
await axios.post("/api/auth/login", { token }, { withCredentials: true });
```

Use Vite proxy or `VITE_API_URL=http://localhost:5000/api`.
