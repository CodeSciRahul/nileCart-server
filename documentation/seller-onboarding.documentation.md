# NileCart Seller Onboarding — User & Developer Reference

---

# Part A — User Perspective

*For prospective sellers, operations teams, product managers, and anyone who does not need code-level detail.*

---

## A.1 What Is Seller Onboarding?

Seller onboarding is the end-to-end process for joining NileCart as a **marketplace vendor**. It has three major phases:

1. **Account creation** — Register a seller dashboard account (separate from the customer storefront account).
2. **Seller application** — Submit store details, identity documents, address, and bank information for platform review.
3. **Admin approval** — NileCart admins review the application and either approve or reject the seller.

Once approved, the seller can list products, manage orders, and operate a storefront page on the public marketplace.

---

## A.2 Why Seller Onboarding Matters

### For prospective sellers

| Benefit | What it means for you |
|---------|------------------------|
| **Clear path to sell** | Step-by-step application in the seller dashboard |
| **Trust & compliance** | Document verification protects buyers and legitimate sellers |
| **Dedicated workspace** | Approved sellers get products, orders, and store branding tools |
| **Status visibility** | Track Pending / Approved / Rejected from your profile page |

### For business stakeholders

| Benefit | What it means for the business |
|---------|--------------------------------|
| **Quality control** | Admin gate before any seller can publish products |
| **Fraud reduction** | National ID, address proof, and bank details collected upfront |
| **Marketplace integrity** | Customer and seller accounts are kept separate |
| **Commission setup** | Admins assign commission rate at approval time |
| **Audit trail** | Application data, documents, and approval decisions are stored centrally |

---

## A.3 Who Can Do What?

| Action | Guest | Seller (registered) | Seller (approved) | Admin |
|--------|-------|---------------------|-------------------|-------|
| Register seller dashboard account | Yes (`/signup`) | — | — | No |
| Sign in to seller dashboard | Yes (`/login`) | Yes | Yes | No (use Admin tab) |
| Submit seller application | No | Yes (once) | N/A (already applied) | No |
| View own application status | No | Yes (`/seller/profile`) | Yes | — |
| Edit pending application | No | Yes | — | — |
| Resubmit after rejection | No | Yes (via profile update) | — | — |
| List / manage products | No | No | Yes | Yes (bypass) |
| View seller orders | No | No | Yes | Yes |
| Review seller applications | No | No | No | Yes |
| Approve / reject sellers | No | No | No | Yes |
| Deactivate approved seller | No | No | No | Yes |

**Important separation rule:** If an email or mobile number is already registered as a **customer** on the storefront, it **cannot** be used to register as a seller. Sellers must use credentials that are not tied to an existing customer account.

---

## A.4 How Seller Sign-In Works Today

The seller dashboard (`nileCart-dashboard`) supports:

| Method | Available? | Notes |
|--------|------------|-------|
| **Email + password** (Firebase) | Yes | Primary method for email/password sellers |
| **Google sign-in** | Yes | Skips email OTP verification |
| **Mobile number + OTP** | **No** | Not implemented for seller login (see A.10 and B.13) |
| **Apple sign-in** | Partial | Treated like Google on the server (auto-verified email) if used via Firebase |

After Firebase authentication, the dashboard exchanges the Firebase token for a NileCart JWT session via the backend.

---

## A.5 End-to-End Seller Journey

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 1 — ACCOUNT REGISTRATION (Dashboard: /signup)                    │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Choose Seller signup (not Admin)                                    │
│  2. Register with email/password OR Continue with Google                │
│  3. Backend creates User with role = "seller"                           │
│  4. Email/password users: verify 6-digit OTP sent to email              │
│  5. Google users: skip OTP (marked verified automatically)              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 2 — SIGN IN (Dashboard: /login)                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Sign in with seller credentials                                     │
│  2. If email not verified → OTP verification step before session        │
│  3. Backend returns JWT + user profile (includes seller summary)        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 3 — APPLICATION (Dashboard: /seller/onboarding)                  │
├─────────────────────────────────────────────────────────────────────────┤
│  1. New sellers without a profile are routed to onboarding              │
│  2. Complete 6 sections (details → store → address → docs → bank)       │
│  3. Submit application → status becomes "Pending"                       │
│  4. Redirected to /seller/profile to track review status                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 4 — ADMIN REVIEW (Dashboard: /admin/sellers)                     │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Admin opens application in Seller Applications catalog              │
│  2. Reviews documents, bank info, store branding                        │
│  3. Approves (optional commission %) OR rejects (reason required)       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
            ┌───────────────┐               ┌───────────────┐
            │   APPROVED    │               │   REJECTED    │
            │  /seller      │               │ /seller/profile│
            │  products OK  │               │ edit & resubmit│
            └───────────────┘               └───────────────┘
```

---

## A.6 Seller Application Form (Six Steps)

The onboarding wizard at `/seller/onboarding` walks applicants through:

| Step | Section | What you provide |
|------|---------|------------------|
| 1 | **Your details** | Legal full name, mobile number |
| 2 | **Store** | Store name, description, logo, banner, optional TIN |
| 3 | **Address** | Business / operating address (line, city, state, country, pincode) |
| 4 | **Documents** | Government ID, business proof, address proof (file uploads) |
| 5 | **Bank & identity** | Bank account holder name, account number, IFSC code, national ID number |
| 6 | **Submit** | Review and send application |

### Document requirements (client-enforced)

All three documents are **required** before submit:

- **Government ID** — national ID, passport, or driving licence
- **Business proof** — registration certificate or trade licence
- **Address proof** — recent utility bill or bank statement

### Tips shown in the dashboard

- Applications are typically reviewed within **2–3 business days**
- Track status on the **profile page** after submitting
- If rejected, you can **update details and resubmit** from your profile

---

## A.7 Application Status States

After submission, every seller profile has an `approvalStatus`:

| Status | What it means | Where you land | What you can do |
|--------|---------------|----------------|-----------------|
| **Pending** | Awaiting admin review | `/seller/profile` | Edit most application fields; cannot sell yet |
| **Approved** | Active marketplace seller | `/seller` dashboard | Manage products, orders, limited profile edits |
| **Rejected** | Application declined | `/seller/profile` | Read rejection reason; edit and resubmit for review |

### After approval

Approved sellers can:

- Access the seller home dashboard (`/seller`) with stats
- Create and manage products (`/seller/products`)
- Fulfill orders (`/seller/orders`)
- Update branding (logo, banner, description), address, bank details, and documents
- Appear on the public storefront via their store slug (when products are live)

They **cannot** change core identity fields like store name or national ID through the approved-only edit path (those were locked at approval).

---

## A.8 Rejection & Resubmission Workflow

When an admin rejects an application:

1. A **rejection reason** is saved and shown on the seller profile page.
2. The seller can update application details from `/seller/profile`.
3. Saving changes after rejection automatically moves status back to **Pending** and clears the rejection reason.
4. The application re-enters the admin review queue.

> **Note:** The backend `POST /sellers/apply` endpoint blocks a second application if status is already Rejected (message: contact support). In practice, rejected sellers **already have a profile** and resubmit via **profile update**, not a new apply call.

---

## A.9 Admin Review Workflow

Admins manage sellers from the dashboard:

### Browse applications

1. Sign in with **Admin** tab on `/login`
2. Go to **Seller Applications** (`/admin/sellers`)
3. Filter tabs: **Pending**, **Approved**, **Rejected**

### Review a single application

1. Open seller detail (`/admin/seller/:id`)
2. Inspect store info, contact details, uploaded documents, and bank details
3. Choose action:

| Action | Requirement | Effect |
|--------|-------------|--------|
| **Approve** | Optional commission rate (0–100%) | Seller can sell; `approvalStatus = Approved` |
| **Reject** | Rejection reason (required) | Seller cannot sell; reason visible to seller |
| **Deactivate** | — | Sets `isActive = false` (approved sellers only) |

---

## A.10 What Is Not Available Yet (User-Facing)

| Feature | Status |
|---------|--------|
| **Mobile number + OTP login** for sellers | **Not available** — sign-in is email/password or Google only |
| **Mobile OTP verification** during onboarding | Mobile is collected but **not verified** via OTP |
| Seller self-service account deletion tied to application | Uses general account delete flow |
| Email notification when application approved/rejected | Not implemented in current codebase |
| In-app seller onboarding on mobile app | Dashboard web only today |
| Automatic payout / KYC provider integration | Bank details stored manually; no payment-rail KYC hookup |

---

## A.11 Practical Tips for Prospective Sellers

1. **Use a dedicated email** — do not reuse an email already registered as a customer on the storefront.
2. **Match documents to form data** — national ID number and address should align with uploaded proofs.
3. **Prepare clear logo/banner images** — store branding appears on your public store page.
4. **Verify email promptly** — email/password accounts cannot fully proceed until OTP verification completes.
5. **Check profile after submit** — `/seller/profile` is your status hub while Pending or Rejected.

---

## A.12 Practical Tips for Operations & Admin Teams

1. **Review all three documents** before approving — they are mandatory in the UI.
2. **Set commission rate at approval** — defaults to 0 if omitted.
3. **Write clear rejection reasons** — sellers can fix issues and resubmit from their profile.
4. **Deactivate rather than reject** approved sellers** who need to be suspended — rejection is for pending applications.
5. **Plan for Uganda launch** — bank form currently uses IFSC (India-centric); consider local banking fields before go-live (see B.13).

---

---

# Part B — Developer Perspective

*For engineers implementing, integrating, or maintaining seller onboarding.*

---

## B.1 Architecture Overview

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  nileCart-dashboard (Seller & Admin SPA)                                 │
│                                                                          │
│  /signup, /login          useAuthForm.js + Firebase Auth                 │
│       │                     ├── registerSellerAccount → POST /auth/seller/register
│       │                     ├── sendSellerSignupOtp   → POST /auth/seller/send-otp
│       │                     ├── verifySellerSignupOtp → POST /auth/seller/verify-otp
│       │                     └── syncSellerBackendSession → POST /auth/login/seller
│                                                                          │
│  /seller/onboarding       Onboarding.jsx → POST /sellers/apply           │
│  /seller/profile          Profile.jsx   → GET/PATCH /sellers/me/profile│
│  /seller/* (products…)    ProtectedRoute requireApprovedSeller         │
│                                                                          │
│  /admin/sellers           SellerApplicationsCatalog.jsx                │
│  /admin/seller/:id        AdminSellerDetail.jsx → admin seller APIs    │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  nileCart-server                                                         │
│                                                                          │
│  routes/user.route.js (mounted at /auth and /users)                    │
│       ├── POST /auth/seller/register      registerSellerAccount          │
│       ├── POST /auth/seller/send-otp      sendSellerSignupOtp            │
│       ├── POST /auth/seller/verify-otp    verifySellerSignupOtp          │
│       └── POST /auth/login/seller         loginSeller                    │
│                                                                          │
│  routes/seller.route.js (mounted at /sellers)                            │
│       ├── POST /apply                     applyForSeller                 │
│       ├── GET  /me/profile                getMySellerProfile             │
│       ├── PATCH /me/profile               updateMySellerProfile          │
│       ├── GET  /me/stats                  getSellerStats                 │
│       └── GET  /:slug                     getSellerBySlug (public)       │
│                                                                          │
│  routes/admin.route.js                                                   │
│       ├── GET   /admin/sellers            listSellers                    │
│       ├── GET   /admin/sellers/:id        getSellerById                  │
│       ├── PATCH /admin/sellers/:id/approve approveSeller                 │
│       ├── PATCH /admin/sellers/:id/reject  rejectSeller                  │
│       └── PATCH /admin/sellers/:id/deactivate deactivateSeller           │
│                                                                          │
│  controller/otp.controller.js    — registration + email OTP            │
│  controller/user.controller.js   — loginSeller, profile, JWT session     │
│  controller/seller.controller.js — apply, profile, admin moderation      │
│  utils/otpHelpers.js             — OTP generate/hash/verify              │
│  utils/authHelpers.js            — Firebase verify, customer/seller rules  │
│  service/upload.service.js       — presigned S3 uploads for documents    │
└──────────────────────────────────────────────────────────────────────────┘
```

**Source of truth files:**

| Layer | Path |
|-------|------|
| Seller model | `models/Seller.model.js` |
| User model | `models/User.model.js` |
| Email OTP model | `models/EmailOtp.model.js` |
| Seller controller | `controller/seller.controller.js` |
| OTP controller | `controller/otp.controller.js` |
| User controller | `controller/user.controller.js` |
| Seller routes | `routes/seller.route.js` |
| Auth routes | `routes/user.route.js` |
| Auth middleware | `middleware/auth.middleware.js` |
| Onboarding UI | `nileCart-dashboard/src/pages/seller/Onboarding.jsx` |
| Profile UI | `nileCart-dashboard/src/pages/seller/Profile.jsx` |
| Auth hook | `nileCart-dashboard/src/hooks/useAuthForm.js` |
| Redirect logic | `nileCart-dashboard/src/lib/redirect.js` |
| Route guard | `nileCart-dashboard/src/components/ProtectedRoute.jsx` |
| Admin review | `nileCart-dashboard/src/pages/admin/AdminSellerDetail.jsx` |

---

## B.2 Database Schema

### User collection (`users`) — seller-relevant fields

```javascript
{
  firebaseUid: String,      // unique, sparse — linked after Firebase sign-in
  email: String,            // unique, sparse, lowercase
  mobileNumber: String,     // unique, sparse — set during seller apply
  name: String,
  role: String,             // "customer" | "seller" | "admin"
  isActive: Boolean,        // default true
  isVerified: Boolean,      // default false — email OTP for sellers
}
```

**Seller account creation:** `registerSellerAccount` creates `role: "seller"`. Google/Apple sign-in sets `isVerified: true` immediately; email/password users start with `isVerified: false` until OTP verification.

### Seller collection (`sellers`)

```javascript
{
  user: ObjectId,           // ref User — required, unique (one seller profile per user)
  storeName: String,        // required
  storeSlug: String,        // required, unique, lowercase — auto from storeName
  logo: StoredImage,
  banner: StoredImage,
  description: String,
  tinNumber: String,
  nationalId: String,       // required, unique
  address: {
    addressLine, city, state, country, pincode
  },
  bankDetails: {
    accountHolderName: String,  // required
    accountNumber: String,      // required
    ifscCode: String            // required (India-centric naming)
  },
  commissionRate: Number,   // 0–100, set on admin approval
  rating: { average, count },
  documents: {
    idProof: StoredImage,
    businessProof: StoredImage,
    addressProof: StoredImage
  },
  isMobileVerified: Boolean,  // default false — NOT set by current flows
  isActive: Boolean,          // default true
  approvalStatus: String,     // "Pending" | "Approved" | "Rejected"
  rejectionReason: String,
  createdAt, updatedAt
}
```

**Indexes:** text index on `storeName` + `description`; `{ isActive: 1, isVerified: 1 }` (note: `isVerified` is referenced on Seller in controller/index but **not declared in schema** — see B.13).

### EmailOtp collection (`emailotps`)

```javascript
{
  email: String,            // lowercase
  otpHash: String,          // SHA-256 of otp + JWT secret
  purpose: "seller_signup", // enum
  attempts: Number,         // max 5 verify attempts
  expiresAt: Date           // TTL index — 10 minute expiry
}
```

---

## B.3 Authentication & Email OTP Flow

### Registration sequence (email/password)

```text
Client                          Server                         Firebase
  │                               │                               │
  │── createUser(email,pwd) ─────►│                               │
  │◄── Firebase user ─────────────│                               │
  │                               │                               │
  │── POST /auth/seller/register ─►│ verifyIdToken                 │
  │   { token }                   │ User.create(role=seller)      │
  │                               │ saveEmailOtp + send email     │
  │◄── requiresVerification ──────│                               │
  │                               │                               │
  │── POST /auth/seller/verify-otp►│ verifyEmailOtp                │
  │   { email, otp }              │ user.isVerified = true        │
  │                               │                               │
  │── signInWithEmailAndPassword ─►│                               │
  │── POST /auth/login/seller ───►│ assertCanAccessSellerAuth     │
  │                               │ issue JWT + set cookie        │
  │◄── { user, token } ───────────│                               │
```

### Google sign-in shortcut

`isGoogleSignIn(decoded)` checks `decoded.firebase.sign_in_provider` for `google.com` or `apple.com`. These users:

- Skip email OTP on registration (`isVerified: true` at create)
- Skip OTP gate on `loginSeller`

### OTP security parameters (`utils/otpHelpers.js`)

| Setting | Value |
|---------|-------|
| OTP length | 6 digits |
| Expiry | 10 minutes |
| Max verify attempts | 5 per OTP record |
| Storage | Hashed (not plaintext) |
| Purpose | `seller_signup` |

### Customer / seller identity rules (`utils/authHelpers.js`)

- `assertEmailMobileNotRegisteredAsCustomer` — blocks seller registration if email/mobile belongs to a **customer** account.
- `CUSTOMER_CANNOT_BECOME_SELLER_MESSAGE` — returned when a logged-in customer tries to apply.
- `assertCanAccessSellerAuth` — blocks admin accounts from seller login; migrates legacy customer+seller-profile users to seller role.

---

## B.4 Post-Login Routing

`getDefaultRouteForUser` in `nileCart-dashboard/src/lib/redirect.js`:

```javascript
seller + no seller profile     → /seller/onboarding
seller + approvalStatus Approved → /seller
seller + Pending or Rejected   → /seller/profile
admin                          → /admin
```

`ProtectedRoute` with `requireApprovedSeller` redirects non-approved sellers to `/seller/profile` (used for products, orders, seller home).

---

## B.5 API Reference

Base API prefix: `/api` (see server mount). Auth endpoints are under **`/api/auth`**; profile under **`/api/users`**.

### B.5.1 `POST /auth/seller/register` — Public

Create or resume seller account after Firebase registration.

**Body:**

```json
{ "token": "<Firebase ID token>" }
```

**Behavior:**

| Case | Response |
|------|----------|
| New email, email/password Firebase | 201/200, `requiresVerification: true`, OTP emailed |
| New email, Google/Apple Firebase | `requiresVerification: false`, `isVerified: true` |
| Existing seller, unverified | OTP resent, `requiresVerification: true` |
| Existing verified seller | 400 — already exists, sign in |
| Email belongs to customer | 403 — customer account conflict |

---

### B.5.2 `POST /auth/seller/send-otp` — Public

Resend signup verification OTP.

**Body:** `{ "email": "seller@example.com" }`

**Errors:** 404 if no seller user; 400 if already verified.

---

### B.5.3 `POST /auth/seller/verify-otp` — Public

Verify email OTP.

**Body:** `{ "email": "...", "otp": "123456" }`

**Success:** Sets `user.isVerified = true`.

---

### B.5.4 `POST /auth/login/seller` — Public

Exchange Firebase token for NileCart JWT session.

**Body:** `{ "token": "<Firebase ID token>" }`

**Gates:**

- Requires verified email on Firebase token
- Blocks unverified email/password sellers with **403** and OTP message
- Creates seller user on-the-fly for **new Google** sign-ins only

> **Implementation note:** When login is blocked for unverified email, the server generates an OTP via `saveEmailOtp` but **`sendSellerVerificationOtp` is currently commented out** in `loginSeller`. Clients should use `POST /auth/seller/send-otp` for reliable delivery (see B.13).

**Success response:**

```json
{
  "success": true,
  "data": {
    "token": "<JWT>",
    "user": {
      "_id": "...",
      "email": "...",
      "role": "seller",
      "isVerified": true,
      "seller": {
        "approvalStatus": "Pending",
        "storeName": "...",
        "storeSlug": "..."
      }
    }
  }
}
```

JWT is also set as an HTTP-only cookie when configured.

---

### B.5.5 `POST /sellers/apply` — Protected (`seller` role)

Submit initial seller application.

**Auth:** `protect` + `authorize("seller")`

**Body (required fields highlighted):**

```json
{
  "name": "Jane Seller",
  "mobileNumber": "+256700000000",
  "storeName": "Jane's Boutique",
  "nationalId": "CM12345678",
  "description": "Optional",
  "tinNumber": "Optional",
  "address": { "addressLine": "...", "city": "...", "state": "...", "country": "...", "pincode": "..." },
  "bankDetails": { "accountHolderName": "...", "accountNumber": "...", "ifscCode": "..." },
  "documents": { "idProof": { "url", "key" }, "businessProof": {...}, "addressProof": {...} },
  "logo": { "url", "key" },
  "banner": { "url", "key" }
}
```

**Server actions:**

- Updates `User.name` and `User.mobileNumber`
- Generates unique `storeSlug` from `storeName`
- Creates `Seller` with `approvalStatus: "Pending"`
- Rejects duplicate pending/approved applications; rejects re-apply via this endpoint if Rejected

**Response:** `201` with `formatSellerForDashboard(seller)`.

---

### B.5.6 `GET /sellers/me/profile` — Protected

**Auth:** `protect` + `requireSellerProfile`

Returns full seller profile for dashboard (includes documents, bank details).

---

### B.5.7 `PATCH /sellers/me/profile` — Protected

**Auth:** `protect` + `requireSellerProfile`

**Editable fields by status:**

| Status | Editable fields |
|--------|-----------------|
| **Pending** | storeName, nationalId, description, tinNumber, address, bankDetails, documents, logo, banner |
| **Rejected** | Same as Pending; saving sets `approvalStatus` back to `"Pending"` and clears `rejectionReason` |
| **Approved** | logo, banner, description, address, bankDetails, documents only |

---

### B.5.8 Admin seller moderation

All require `protect` + `authorize("admin")`.

| Method | Path | Body | Notes |
|--------|------|------|-------|
| `GET` | `/admin/sellers?status=Pending` | — | List applications |
| `GET` | `/admin/sellers/:id` | — | Detail view |
| `PATCH` | `/admin/sellers/:id/approve` | `{ "commissionRate": 10 }` | Sets Approved, optional commission |
| `PATCH` | `/admin/sellers/:id/reject` | `{ "reason": "..." }` | Reason required |
| `PATCH` | `/admin/sellers/:id/deactivate` | — | Sets `isActive: false` |

---

### B.5.9 `GET /sellers/:slug` — Public

Returns approved, active seller storefront card (no bank/documents/commission).

---

## B.6 Middleware Reference

| Middleware | Purpose |
|------------|---------|
| `protect` | Validates JWT from cookie or `Authorization: Bearer` |
| `authorize("seller")` | Role must be seller |
| `authorize("admin")` | Role must be admin |
| `requireSellerProfile` | Loads `req.seller`; 404 if no profile |
| `requireApprovedSeller` | Seller must be Approved + active; used for products, orders, stats |

**Product/order gate:** `requireApprovedSeller` on `routes/product.route.js` and `routes/order.route.js` ensures pending sellers cannot list products or access order APIs.

---

## B.7 File Uploads (Documents & Branding)

Onboarding uses presigned S3 uploads via `POST /api/uploads/presign`.

| Asset | Upload folder | Who can upload |
|-------|---------------|----------------|
| Store logo | `store-logos` | Seller (pre-approval OK) |
| Store banner | `store-banners` | Seller (pre-approval OK) |
| ID / business / address proof | `seller-documents` | Seller (documentType: `id-proof`, `business-proof`, `address-proof`) |
| Product images | `products` | **Approved sellers only** |

Comment in `upload.service.js`: store logos/banners work during onboarding before a seller profile exists (uses `userId` as fallback `sellerId`).

---

## B.8 Frontend Implementation Notes

### Auth hook (`useAuthForm.js`)

| Flow | Behavior |
|------|----------|
| Seller signup | Firebase register → `registerSellerAccount` → OTP step if needed |
| Seller signin | Firebase signin → `loginSeller`; 403 triggers OTP UI |
| OTP verify | `verifySellerSignupOtp` → Firebase signin → `loginSeller` |
| Resend OTP | `sendSellerSignupOtp` with 60s cooldown |
| Google | Popup sign-in; signup also calls `registerSellerAccount` |

### Onboarding guard

`Onboarding.jsx` redirects to `/seller/profile` if `user.seller` already exists (prevents duplicate apply UI).

### Profile guard

`Profile.jsx` redirects to `/seller/onboarding` if seller profile fetch fails and user has no embedded seller summary.

### Admin UI

- `SellerApplicationsCatalog.jsx` — tabbed list by approval status
- `AdminSellerDetail.jsx` — approve (commission input), reject (reason textarea), deactivate

---

## B.9 Validation Summary

| Rule | Enforced where |
|------|----------------|
| Seller role required to apply | Server `applyForSeller` |
| Customer cannot become seller | Server auth + apply |
| Email/mobile not on customer account | Server `assertEmailMobileNotRegisteredAsCustomer` |
| Unique store slug | Server on apply + storeName change |
| Unique national ID | Server on apply + nationalId change |
| Unique mobile on apply | Server `User.findOne` |
| All 3 documents required | Client `validateDocuments()` in Onboarding.jsx |
| 6-digit OTP format | Server `verifySellerSignupOtp` |
| Rejection reason on admin reject | Server `rejectSeller` |

---

## B.10 Testing Checklist

- [ ] Seller signup (email/password) → OTP email → verify → login → JWT issued
- [ ] Seller signup (Google) → no OTP → login succeeds
- [ ] Customer email blocked on seller register (403)
- [ ] Complete onboarding form → `POST /sellers/apply` → status Pending
- [ ] Pending seller blocked from `POST /products` (403)
- [ ] Admin approve → seller reaches `/seller`, can create product
- [ ] Admin reject with reason → seller sees reason on profile
- [ ] Rejected seller PATCH profile → status returns to Pending
- [ ] Approved seller cannot change storeName via PATCH (only approved field set)
- [ ] Public `GET /sellers/:slug` only returns Approved + active
- [ ] Document uploads succeed during onboarding (store-logos, seller-documents)
- [ ] Resend OTP via `/auth/seller/send-otp` after failed login OTP path
- [ ] `getDefaultRouteForUser` routes correctly for each approval state

---

## B.11 Known Gaps & Future Improvements

| Gap | Recommendation |
|-----|----------------|
| **Mobile number + OTP login not available** | Add Firebase Phone Auth (or SMS provider) to dashboard login/signup; verify mobile during onboarding; set `Seller.isMobileVerified = true`; mirror email OTP UX in `useAuthForm.js` |
| **Mobile collected but never verified** | Send OTP at apply time or add optional verify step in onboarding step 1 |
| **`loginSeller` OTP email not sent** | Uncomment `sendSellerVerificationOtp` in `user.controller.js` or remove dead `saveEmailOtp` call to avoid confusion |
| **`Seller.isVerified` used but not in schema** | Add field to `Seller.model.js` or remove from `approveSeller` / index |
| **`POST /sellers/apply` vs profile resubmit mismatch** | Align messaging: rejected sellers use PATCH `/me/profile`, not apply |
| **IFSC-only bank field** | Rename/generalize to `bankCode` or add Uganda-specific fields (SWIFT, bank name) for local payouts |
| **No approval/rejection email** | Trigger transactional email from `approveSeller` / `rejectSeller` |
| **No seller notification webhooks** | Optional Slack/email for admin queue when new Pending application arrives |
| **Commission rate validation in admin UI** | Enforce 0–100 on client; server already clamps via schema min/max |
| **Hardcoded OTP in loginSeller console.log** | Remove debug log of OTP in production path |
| **Payment gateway KYC** | Integrate Flutterwave subaccount / similar when marketplace payouts go live |

### Future: Mobile OTP login (planned implementation outline)

When implemented, a typical flow would be:

```text
1. Seller enters mobile on /login or /signup
2. Firebase Phone Auth (or server SMS OTP) sends code
3. User verifies OTP → Firebase session
4. POST /auth/login/seller with token (resolveUserFromFirebase already accepts phone_number)
5. Optional: POST /sellers/verify-mobile to flip isMobileVerified
```

Until this ships, **document and UI copy should state that seller authentication is email-based (or Google) only**.

---

## B.12 Related Documentation

- Catalog (seller product management after approval): `documentation/catalog.documentation.md`
- Reviews (seller accountability on storefront): `documentation/review.documentation.md`
- HTTP summary: `API.md`

---

*Last updated to reflect the NileCart seller onboarding implementation across the seller dashboard, server API, and admin moderation flows.*
