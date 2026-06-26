# NileCart Catalog System — User & Developer Reference

*Categories, products, and the multi-vendor marketplace catalog.*

---

# Part A — User Perspective

*For customers, sellers, product managers, business stakeholders, and anyone who does not need code-level detail.*

---

## A.1 What Is the Catalog?

The **catalog** is everything shoppers browse and buy on NileCart: **categories** (how products are organized) and **products** (what sellers list for sale).

NileCart is a **multi-vendor marketplace**:

- **Platform admins** build the category tree (departments, subcategories, navigation)
- **Approved sellers** create product listings with photos, prices, sizes, and stock
- **Customers** browse, filter, and purchase through the storefront

---

## A.2 Why the Catalog Matters

### For customers

| Benefit | What it means for you |
|---------|------------------------|
| **Easy browsing** | Shop by department (Men, Women, Kids…) and category |
| **Find what you need** | Search, filters (size, color, price, brand), and sort options |
| **Informed choices** | Product detail with variants, ratings, and seller info |
| **Trust** | Products come from verified sellers in admin-approved categories |

### For sellers

| Benefit | What it means for you |
|---------|------------------------|
| **Reach customers** | List products in the right category once approved |
| **Control your inventory** | Manage variants, stock, pricing, and images |
| **Own your store** | Each listing ties to your seller profile |

### For business stakeholders

| Benefit | What it means for the business |
|---------|--------------------------------|
| **Merchandising control** | Admins shape navigation and category structure |
| **Marketplace growth** | More sellers → more products → broader assortment |
| **Quality gate** | Seller approval before listing; soft-delete instead of data loss |
| **Campaign support** | Categories and products tie into coupons, trending, and sale flags |

---

## A.3 How the Catalog Is Organized

NileCart uses a **two-level category tree** grouped by **departments**:

```text
Department (e.g. Women, Men, Kids, Sports, Beauty, Home, Accessories)
  └── Top-level category (department anchor in navigation)
        └── Subcategory (e.g. Dresses, Tops, Bottoms)  ← sellers assign products here
```

**Departments** appear in the header navigation. **Subcategories** are where sellers typically attach products.

Products always belong to **one seller** and **one category**, and have one or more **variants** (size/color/SKU with its own price and stock).

---

## A.4 Who Can Do What?

| Action | Admin | Approved seller | Customer | Guest |
|--------|-------|-----------------|----------|-------|
| Create / edit / deactivate **categories** | Yes | No | No | No |
| Create / edit / deactivate **products** | Yes* | Yes (own store) | No | No |
| Browse & search products | Yes | Yes | Yes | Yes |
| View inactive catalog items | Yes (dashboard) | Own products only | No | No |

\*Admin creating products must specify which seller owns the listing.

Sellers with **Pending** or **Rejected** approval **cannot** list products.

---

## A.5 Admin Workflows — Categories

### Create a department (top-level category)

1. **Admin Dashboard** → **Categories** → **Create category**
2. Leave **Parent** empty; select **Department type** (e.g. Women)
3. Enter name, optional image and description
4. Set **Display order** and **Show in navigation**
5. Save — appears in storefront header after refresh

### Add a subcategory

1. Create category with a **parent** selected (e.g. Women)
2. Enter subcategory name (e.g. Dresses) — department is inherited
3. Sellers can now assign products to this subcategory

### Deactivate a category

Deactivate hides it from the storefront. Deactivating a **top-level category** also deactivates its **child subcategories**. Products in retired categories should be reassigned or deactivated separately.

---

## A.6 Seller Workflows — Products

### Prerequisites

- Seller application **Approved** and account **Active**

### List a new product

1. **Seller Dashboard** → **Products** → **Add product**
2. Enter **title** and **description**
3. Pick a **category** (leaf subcategory from the tree)
4. Set **gender** (Men / Women)
5. Upload **product images** (first image = cover in listings)
6. Add **tags** for search (optional)
7. Add **variants** — at least one row with SKU, size, color, price, MRP, stock
8. Save — product appears on storefront when active

### Edit or deactivate

- **Edit** — update any field except ownership
- **Deactivate** — hides from storefront; can reactivate later

### Seller tips

- Use **unique SKUs** per variant
- Set **MRP** ≥ selling **price** (MRP is the strikethrough “was” price)
- Pick the **most specific subcategory** for better discoverability
- Put your **primary/default variant first** — listing cards use the first variant’s price

---

## A.7 Customer Workflows — Shopping

### Browse by category

1. Use header **department menu** (Men, Women, …) or mobile category drawer
2. Tap a category → `/shop/[slug]` shop page
3. Use **filters** — brand, size, color, price range, sale, trending
4. Tap a product card → product detail page

### Search

Use the header search → `/search?q=...` for full-text product search.

### Product detail & purchase

1. View images, description, rating, variants
2. Select **size / color**
3. **Add to bag** or save to **wishlist** (heart)
4. Checkout from bag

---

## A.8 Soft Delete Policy

Categories and products are **not permanently deleted** in normal operations:

- **Deactivate** sets `isActive: false` and hides from storefront
- Past **orders** keep product snapshots (title, price, SKU) even if listing is later deactivated

---

## A.9 What Is Not Available Yet

| Feature | Status |
|---------|--------|
| Seller brand picker in product form | Brands exist in DB; no dashboard UI |
| Seller toggles for Trending / Sale / New Arrival | Flags via API/seed only |
| Admin product management in dashboard | API only |
| Bulk CSV import/export | Not available |
| Auto-deactivate products when category retired | Manual ops required |

---

---

# Part B — Developer Perspective

*For engineers implementing, integrating, or maintaining categories and products.*

---

## B.1 Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│  nileCart-dashboard                                             │
│  Admin: AdminCategoriesList, AdminCategoryForm                  │
│  Seller: Products, ProductForm                                  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────┴─────────────────────────────────┐
│  nileCart-next-web (Storefront)                                 │
│  DepartmentCategoryNav, ShopPage, ProductDetailContent, search  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  nileCart-server                                                │
│  /api/categories      — public read + admin CRUD                │
│  /api/admin/categories — admin write                            │
│  /api/products        — public read + seller CRUD             │
│  models: Category, Product, Brand, Seller                       │
│  utils: categoryHelpers, productHelpers, storedImageHelpers   │
└─────────────────────────────────────────────────────────────────┘
```

**Source of truth files:**

| Area | Path |
|------|------|
| Models | `models/Category.model.js`, `models/Product.model.js`, `models/Brand.model.js` |
| Departments | `constants/departments.js` |
| Category logic | `utils/categoryHelpers.js`, `controller/category.controller.js` |
| Product logic | `utils/productHelpers.js`, `controller/product.controller.js` |
| Routes | `routes/category.route.js`, `routes/product.route.js`, `routes/admin.route.js` |
| Admin UI | `pages/admin/AdminCategoriesList.jsx`, `AdminCategoryForm.jsx` |
| Seller UI | `pages/seller/Products.jsx`, `ProductForm.jsx` |
| Storefront | `components/DepartmentCategoryNav.jsx`, `shop/ShopPage.jsx`, `product/` |

---

## B.2 Database Schema — Category

```javascript
{
  name: String,           // required
  slug: String,           // required, unique, lowercase
  image: StoredImage,     // { url, key }
  description: String,
  parent: ObjectId|null,  // ref Category — null = root
  department: Enum|null,  // men, women, kids, sports, beauty, home, accessories
  displayOrder: Number,   // default 0
  isActive: Boolean,      // default true
  showInNav: Boolean,     // default true
  timestamps
}
```

**Indexes:** `{ parent, isActive, displayOrder }`, `{ department, isActive, displayOrder }`

### Hierarchy rules (`validateCategoryParent`, `resolveCategoryDepartment`)

| Rule | Error |
|------|-------|
| Max **two levels** | Parent cannot have a parent |
| Root must have `department` | `"Department is required for top-level categories."` |
| Subcategory inherits department | From parent |
| Category with children cannot become child | `"Categories with subcategories must remain top-level parents."` |

### Department constants

| Value | Label | Shop gender filter |
|-------|-------|-------------------|
| `men` | Men | `Men` |
| `women` | Women | `Women` |
| `kids`, `sports`, `beauty`, `home`, `accessories` | — | — |

`GENDER_BY_DEPARTMENT` applies when browsing a **parent category with children**.

---

## B.3 Database Schema — Product

```javascript
{
  seller: ObjectId,       // ref Seller — required
  title: String,
  slug: String,           // unique
  description: String,
  category: ObjectId,     // ref Category — required
  brand: ObjectId,        // ref Brand — optional
  images: [StoredImage],
  variants: [Variant],    // min 1
  tags: [String],
  gender: Enum,           // "Women" | "Men", default "Women"
  discountPercent: Number,
  rating: { average, count },  // system-managed from reviews
  isTrending, isNewArrival, isOnSale: Boolean,
  isActive: Boolean,
  timestamps
}
```

### Variant (embedded)

| Field | Required | Notes |
|-------|----------|-------|
| `sku` | Yes | Unique per product; used in cart/orders |
| `size`, `color`, `colorHex` | No | |
| `stock` | No | default 0 |
| `price`, `mrp` | Yes | min 0 |
| `images` | No | Variant-specific photos |

**Text index:** `{ title, tags, description }`  
**Indexes:** `{ category, isActive }`, `{ isTrending, isActive }`

### Listing price rule

`formatProductCard()` uses **first variant's** `price` and `mrp`.

---

## B.4 Category API

### Public — `/api/categories`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/categories` | None | List (filters below) |
| `GET` | `/categories/navigation` | None | Department nav tree |
| `GET` | `/categories/:slug` | None | Category + children |
| `GET` | `/categories/:slug/shop` | None | Shop page: products, facets, pagination |

**Key query params for `GET /categories`:**

| Param | Effect |
|-------|--------|
| `tree=true` | Nested tree |
| `navigation=true` | `{ departments: [...] }` |
| `navOnly=true` | `showInNav: true` only |
| `department`, `parentId`, `rootsOnly`, `subcategoriesOnly` | Filters |

**Shop endpoint filters:** `brand`, `size`, `color`, `minPrice`, `maxPrice`, `isOnSale`, `isTrending`, `page`, `limit`, `sort`.

**Shop scope:** If category has children → products from parent + all active children; leaf → that category only.

### Admin — `/api/admin/categories`

Requires `protect` + `authorize("admin")`.

| Method | Endpoint | Action |
|--------|----------|--------|
| `GET` | `/admin/categories` | All categories (`includeInactive` forced) |
| `POST` | `/admin/categories` | Create |
| `PUT` | `/admin/categories/:id` | Update |
| `DELETE` | `/admin/categories/:id` | Soft-deactivate (+ cascade children if root) |

---

## B.5 Product API

### Public & seller — `/api/products`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/products` | None | Paginated list + filters |
| `GET` | `/products/trending` | None | `isTrending: true` |
| `GET` | `/products/search` | None | `q` or `search` param |
| `GET` | `/products/:slug` | None | Detail (`formatProductForPublic`) |
| `GET` | `/products/store/:slug` | None | By seller `storeSlug` |
| `GET` | `/products/mine` | Seller | Seller's products |
| `POST` | `/products` | Seller | Create |
| `PUT` | `/products/:id` | Seller | Update (own; admin any) |
| `DELETE` | `/products/:id` | Seller | Soft-deactivate |

**Middleware:** `requireApprovedSeller` for write routes and `/mine`.

**Create validation:** `title`, `category`, `variants.length >= 1` required. Admin must pass `seller` ObjectId.

**Update blocked fields:** `seller`, `_id`, `slug`.

**Query filters:** `category`, `brand`, `gender`, `seller`, `minPrice`, `maxPrice`, `isTrending`, `isNewArrival`, `isOnSale`, `search`, `page`, `limit`, `sort`.

---

## B.6 Authentication Middleware

| Middleware | Usage |
|------------|-------|
| `protect` | JWT required |
| `authorize("admin")` | Admin category CRUD |
| `requireApprovedSeller` | Product CRUD; admin bypasses seller check |

---

## B.7 Category Helpers

| Function | Purpose |
|----------|---------|
| `buildCategoryTree(categories)` | Flat list → nested tree |
| `buildDepartmentNavigation(categories)` | Tree → department-grouped nav payload |
| `validateCategoryParent(parentId, categoryId)` | Hierarchy enforcement |
| `resolveCategoryDepartment(parentId, department)` | Root vs inherited department |
| `deactivateCategoryChildren(parentId)` | Cascade deactivate |

---

## B.8 Product Helpers & Formatting

| Function | Purpose |
|----------|---------|
| `formatProductCard(product)` | Grid/card payload (price from variant[0]) |
| `formatProductForPublic(product)` | Detail page with image URLs |
| `formatProductForDashboard(product)` | Seller/admin edit form |
| `findVariant(product, variantSku)` | Cart/order variant lookup |
| `normalizeProductPayload(body)` | Image normalization on create/update |

---

## B.9 Frontend — Admin Dashboard

| Route | Component |
|-------|-----------|
| `/admin/categories` | `AdminCategoriesList` + `CategoryCatalog` |
| `/admin/categories/new` | `AdminCategoryForm` |
| `/admin/categories/:id/edit` | `AdminCategoryForm` |

**CategoryForm sections:** Structure, Details, Media (`UPLOAD_FOLDERS.CATEGORIES`), Display settings.

**CategoryFormGuideSidebar** — in-form help for two-level catalog.

---

## B.10 Frontend — Seller Dashboard

| Route | Component |
|-------|-----------|
| `/seller/products` | `Products` table |
| `/seller/products/new` | `ProductForm` |
| `/seller/products/:id/edit` | `ProductForm` |

**ProductForm client validation (`validateVariants`):**

- SKU required, unique case-insensitive per product
- `price > 0`, `mrp > 0`

**Category picker:** `flattenCategoryOptions()` — **leaf categories only** (skips parents with children).

**Payload:** `buildProductPayload()` in `lib/productUtils.js`.

---

## B.11 Frontend — Storefront (Next.js)

| Component | API | Route |
|-----------|-----|-------|
| `DepartmentCategoryNav` | `GET /categories?navigation=true` | Header |
| `MobileCategorySidebar` | Nav data | Mobile |
| `ShopPage` | `GET /categories/:slug/shop` | `/shop/[slug]` |
| `ShopFilters` | Facets from shop response | URL query state |
| `ProductDetailContent` | `GET /products/:slug` | `/product/[slug]` |
| Search | `GET /products/search?q=` | `/search` |

Filter state: `lib/shopFilters.js` (URL-driven).

---

## B.12 Images & Uploads

| Entity | Folder | Who |
|--------|--------|-----|
| Category | `UPLOAD_FOLDERS.CATEGORIES` | Admin |
| Product / variant | `UPLOAD_FOLDERS.PRODUCTS` | Approved seller |

Flow: `POST /api/uploads/presign` → S3 upload → `{ url, key }` in payload → `storedImageSchema`.

---

## B.13 Integration with Other Features

```text
Cart.items[]     → product + variantSku (live stock check)
Order.items[]    → snapshot at purchase; stock -= qty on variant
Coupon           → applicableCategories / applicableProducts
Review           → updates Product.rating.average / count
Wishlist         → product-level saves
```

### Brand model (limited today)

`Brand` (`name`, `slug`, `logo`, `isActive`) used in shop facets and seed data. **No admin brand CRUD API or seller picker UI.**

---

## B.14 API Examples

### Admin — create subcategory

```http
POST /api/admin/categories
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Dresses",
  "parent": "507f1f77bcf86cd799439011",
  "displayOrder": 3,
  "showInNav": true
}
```

### Seller — create product

```http
POST /api/products
Authorization: Bearer <seller_token>
Content-Type: application/json

{
  "title": "Ribbed Crop Top",
  "category": "507f1f77bcf86cd799439012",
  "gender": "Women",
  "variants": [
    { "sku": "TOP-001-S", "size": "S", "color": "White", "stock": 30, "price": 999, "mrp": 1499 }
  ]
}
```

### Storefront — category shop

```http
GET /api/categories/dresses/shop?page=1&limit=12&size=M,L&minPrice=500&maxPrice=5000
```

---

## B.15 Business Rules Summary (Technical)

**Categories:**

1. Admin-only write access.
2. Two-level depth maximum.
3. Root requires `department`; subcategories inherit.
4. Root deactivation cascades to children.
5. `showInNav` controls header visibility.
6. Slug auto-generated from name.

**Products:**

1. Approved seller (or admin with `seller` id) required to create.
2. Sellers edit/delete own products only; admin any.
3. Minimum one variant with SKU, price, MRP.
4. Soft delete via `isActive: false`.
5. Assign to leaf subcategories for correct browse paths.
6. Stock on variants; decremented at order placement.
7. First variant drives list/card price display.

---

## B.16 Testing Checklist

**Categories:**

- [ ] Admin create root + subcategory
- [ ] Subcategory inherits department
- [ ] Reject third-level parent assignment
- [ ] Deactivate root cascades to children
- [ ] Nav payload groups by department
- [ ] Shop page facets and filters work

**Products:**

- [ ] Seller create with variants
- [ ] Reject duplicate SKU within product
- [ ] Pending seller cannot POST /products
- [ ] Deactivated product hidden from GET /products
- [ ] Order decrements variant stock
- [ ] Search returns text-index matches

---

## B.17 Known Gaps & Future Improvements

| Gap | Recommendation |
|-----|----------------|
| No Brand CRUD UI | `/admin/brands` + seller picker |
| No merchandising toggles in seller form | `isTrending`, `isOnSale`, `isNewArrival` |
| Category deactivate doesn't cascade to products | Warning + bulk deactivate |
| Slug changes with name | Explicit slug edit or redirects |
| First-variant-only list price | Min–max range in cards |
| No bulk import | CSV for admin/seller |
| No admin product UI | Admin product management page |
| ₹ currency in UI | Localize for UGX |

---

## B.18 Related Documentation

- Coupons (category/product scoping): `documentation/coupon.documentation.md`
- Wishlist: `documentation/wishlist.documentation.md`
- Reviews (product ratings): `documentation/review.documentation.md`
- HTTP summary: `API.md`
- Seed data: `scripts/seed.js`

---

*Last updated to reflect the NileCart catalog implementation across admin dashboard, seller dashboard, server API, and Next.js storefront.*
