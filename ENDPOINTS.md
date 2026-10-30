# DART.ng API - Endpoints & Sub-Endpoints Documentation

> **Base URL:** `http://localhost:3000/api/v1`  
> **Interactive Swagger Documentation:** `http://localhost:3000/api/docs`  
> **Authentication Header:** `Authorization: Bearer <access_token>`

---

## Table of Contents

1. [Root & Health Check](#1-root--health-check)
2. [Authentication (`/auth`)](#2-authentication-auth)
3. [Users & Addresses (`/users`)](#3-users--addresses-users)
4. [Riders & Availability (`/riders`)](#4-riders--availability-riders)
5. [Pricing & Delivery Quotes (`/orders`)](#5-pricing--delivery-quotes-orders)
6. [Packages & Inbound Shipments (`/packages`)](#6-packages--inbound-shipments-packages)
7. [Orders & Delivery Lifecycle (`/orders`)](#7-orders--delivery-lifecycle-orders)
8. [Payments & Saved Cards (`/payments`)](#8-payments--saved-cards-payments)
9. [Wallet & Double-Entry Ledger (`/wallet`)](#9-wallet--double-entry-ledger-wallet)
10. [Public Milestone Tracking (`/tracking`)](#10-public-milestone-tracking-tracking)
11. [Ratings & Reviews (`/ratings`)](#11-ratings--reviews-ratings)
12. [Support & Issue Reporting (`/support`)](#12-support--issue-reporting-support)
13. [Notifications (`/notifications`)](#13-notifications-notifications)
14. [Chat & Messaging (`/chats`)](#14-chat--messaging-chats)
15. [Admin & Operations (`/admin`)](#15-admin--operations-admin)

---

## 1. Root & Health Check

### Endpoint Overview
| Method | Endpoint | Access | Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Public | System status, version, and environment health check |

#### `GET /api/v1/`
- **Explanation:** Confirms that the API server is online, operational, and returns server metadata, including current environment and timestamp.
- **Access:** Public (No Bearer token required).
- **Response:**
  ```json
  {
    "name": "DART.ng API",
    "version": "1.0.0",
    "status": "operational",
    "environment": "development",
    "documentation": "/api/docs",
    "timestamp": "2026-10-25T16:00:00.000Z"
  }
  ```

---

## 2. Authentication (`/auth`)

### Endpoint Overview
| Method | Endpoint | Access | Summary |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/signup/customer` | Public | Register a new customer account |
| `POST` | `/auth/signup/rider` | Public | Register a new rider account with driver profile |
| `POST` | `/auth/google/customer` | Public | Authenticate/register customer via Google OAuth |
| `POST` | `/auth/google/rider` | Public | Authenticate/register rider via Google OAuth |
| `POST` | `/auth/login` | Public | Authenticate with email or phone and password |
| `POST` | `/auth/refresh` | Public | Rotate and renew expired JWT access token |
| `POST` | `/auth/logout` | Public | Terminate session and revoke active refresh token |
| `POST` | `/auth/otp/request` | Public | Request an OTP code via email or SMS |
| `POST` | `/auth/otp/verify` | Public | Verify submitted OTP code |
| `POST` | `/auth/check-identifier` | Public | Check if an account already exists for an identifier |
| `POST` | `/auth/reset-password` | Public | Reset password using a verified OTP code |

---

### Detailed Endpoint Explanations

#### `POST /api/v1/auth/signup/customer`
- **Explanation:** Registers a new customer account using either an email or phone number. Automatically hashes the password using Argon2id, assigns the `CUSTOMER` role, creates a customer wallet, and returns JWT tokens (`accessToken`, `refreshToken`) and user profile.
- **Request Body:**
  ```json
  {
    "email": "customer@dart.ng",          // Optional if phoneNumber is provided
    "phoneNumber": "+2348012345678",      // Optional if email is provided
    "password": "SecurePassword123!",     // Minimum 6 characters
    "fullName": "David Alabi"             // Optional
  }
  ```

#### `POST /api/v1/auth/signup/rider`
- **Explanation:** Registers a new delivery rider account. Assigns the `RIDER` role, provisions an initial rider profile, initializes a driver settlement wallet, and sets default offline availability.
- **Request Body:**
  ```json
  {
    "email": "rider@dart.ng",
    "phoneNumber": "+2348098765432",
    "password": "SecurePassword123!",
    "fullName": "Rider John"
  }
  ```

#### `POST /api/v1/auth/google/customer`
- **Explanation:** Handles single-sign-on (SSO) with Google for customers. Verifies Google token, matches or provisions a customer user record, and returns authentication tokens.
- **Request Body:**
  ```json
  {
    "tokenOrId": "google-oauth2-id-token",
    "email": "customer@gmail.com",
    "firstName": "Chidi",
    "lastName": "Okonkwo",
    "profileImageUrl": "https://lh3.googleusercontent.com/avatar.jpg"
  }
  ```

#### `POST /api/v1/auth/google/rider`
- **Explanation:** Handles Google SSO for riders. Creates or logs into a rider profile and returns JWT tokens.
- **Request Body:** Same schema as `/auth/google/customer`.

#### `POST /api/v1/auth/login`
- **Explanation:** Authenticates an existing user (customer, rider, or admin) using an identifier (email or phone) and password. Enforces Argon2id verification and logs IP and User-Agent metadata.
- **Request Body:**
  ```json
  {
    "identifier": "customer@dart.ng",
    "password": "SecurePassword123!"
  }
  ```

#### `POST /api/v1/auth/refresh`
- **Explanation:** Exchanges a valid refresh token for a newly minted JWT access token and rotated refresh token without requiring re-entry of credentials.
- **Request Body:**
  ```json
  {
    "refreshToken": "eyJhbGciOi..."
  }
  ```

#### `POST /api/v1/auth/logout`
- **Explanation:** Revokes the supplied refresh token from the database, preventing further token refreshes.
- **Request Body:**
  ```json
  {
    "refreshToken": "eyJhbGciOi..."
  }
  ```

#### `POST /api/v1/auth/otp/request`
- **Explanation:** Dispatches a time-limited 6-digit OTP code to the user's phone or email address for account verification or password recovery.
- **Request Body:**
  ```json
  {
    "identifier": "+2348012345678",
    "type": "PHONE_VERIFICATION" // or "EMAIL_VERIFICATION", "PASSWORD_RESET"
  }
  ```

#### `POST /api/v1/auth/otp/verify`
- **Explanation:** Validates the OTP code entered by the user against the record stored in the database.
- **Request Body:**
  ```json
  {
    "identifier": "+2348012345678",
    "code": "123456"
  }
  ```

#### `POST /api/v1/auth/check-identifier`
- **Explanation:** Pre-checks if an email or phone number is already registered before beginning signup or login flows.
- **Request Body:**
  ```json
  {
    "identifier": "user@dart.ng"
  }
  ```

#### `POST /api/v1/auth/reset-password`
- **Explanation:** Sets a new password for an account after verifying the OTP code.
- **Request Body:**
  ```json
  {
    "identifier": "+2348012345678",
    "code": "123456",
    "newPassword": "NewSecurePassword456!"
  }
  ```

---

## 3. Users & Addresses (`/users`)

### Endpoint Overview
| Method | Endpoint | Access | Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/users/me` | Authenticated | Retrieve current user profile and KYC status |
| `PATCH` | `/users/me` | Authenticated | Update basic profile information |
| `POST` | `/users/onboarding` | Authenticated | Save onboarding details (avatar, name, gender) |
| `POST` | `/users/me/onboarding` | Authenticated | Alias to save onboarding details |
| `PATCH` | `/users/me/complete-profile` | Authenticated | Complete profile to unlock booking features |
| `GET` | `/users/addresses` | Authenticated | List all saved delivery/pickup addresses |
| `POST` | `/users/addresses` | Authenticated | Save a new delivery/pickup address |
| `DELETE` | `/users/addresses/:id` | Authenticated | Delete a saved address by ID |
| `GET` | `/users/verification` | Authenticated | Get verification checklist and KYC state |
| `GET` | `/users/me/verification` | Authenticated | Alias for account verification checklist |
| `POST` | `/users/verification/nin` | Authenticated | Submit 11-digit NIN and ID document |
| `POST` | `/users/kyc/nin` | Authenticated | Alias to submit NIN for verification |
| `POST` | `/users/verification/email` | Authenticated | Verify email address |
| `POST` | `/users/verification/phone` | Authenticated | Verify phone number |

---

### Detailed Endpoint Explanations

#### `GET /api/v1/users/me`
- **Explanation:** Returns the full authenticated user entity, including contact details, profile image, role, verification state, and wallet balance summary.
- **Access:** Bearer Token.

#### `PATCH /api/v1/users/me`
- **Explanation:** Updates editable profile fields such as name, phone number, avatar URL, or gender.
- **Request Body:**
  ```json
  {
    "firstName": "Chidi",
    "lastName": "Okonkwo",
    "phoneNumber": "+2348012345678",
    "profileImageUrl": "https://cdn.dart.ng/avatars/user-1.jpg",
    "gender": "male" // "male", "female", "other"
  }
  ```

#### `POST /api/v1/users/onboarding` & `POST /api/v1/users/me/onboarding`
- **Explanation:** Saves user profile attributes during initial onboarding. Accepts full name, preferred gender, avatar, initial home address, and an optional immediate verification flag.
- **Request Body:**
  ```json
  {
    "firstName": "Adebayo",
    "lastName": "Okonkwo",
    "gender": "male",
    "profileImageUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
    "phoneNumber": "+2347031013632",
    "address": "Auchi, Edo State",
    "verifyNow": false
  }
  ```

#### `PATCH /api/v1/users/me/complete-profile`
- **Explanation:** Requires first name and last name to unlock booking, package creation, and checkout capabilities.
- **Request Body:**
  ```json
  {
    "firstName": "Chidi",
    "lastName": "Okonkwo",
    "phoneNumber": "+2348012345678"
  }
  ```

#### `GET /api/v1/users/addresses`
- **Explanation:** Lists all addresses saved by the user (e.g. Home, Office, Warehouse) with geographic coordinates and recipient contact info.
- **Access:** Bearer Token.

#### `POST /api/v1/users/addresses`
- **Explanation:** Adds and persists a new address to the user's address book with optional coordinates and default toggle.
- **Request Body:**
  ```json
  {
    "title": "Home",
    "street": "15 Admiralty Way, Lekki Phase 1",
    "city": "Lagos",
    "state": "Lagos State",
    "postalCode": "105102",
    "latitude": 6.4474,
    "longitude": 3.4723,
    "contactName": "Chidi Okonkwo",
    "contactPhone": "+2348012345678",
    "isDefault": true
  }
  ```

#### `DELETE /api/v1/users/addresses/:id`
- **Explanation:** Deletes a specific saved address by its UUID.
- **URL Parameter:** `id` (address UUID).

#### `GET /api/v1/users/verification` & `GET /api/v1/users/me/verification`
- **Explanation:** Retrieves the user's KYC verification progress, detailing whether email, phone, and NIN have been verified.
- **Access:** Bearer Token.

#### `POST /api/v1/users/verification/nin` & `POST /api/v1/users/kyc/nin`
- **Explanation:** Submits an 11-digit National Identity Number (NIN) and optional government ID document photo for KYC identity validation.
- **Request Body:**
  ```json
  {
    "nin": "12345678901",
    "idCardImage": "https://cdn.dart.ng/kyc/nin-card-1.jpg",
    "idType": "NIN" // "NIN", "VOTERS_CARD", "DRIVERS_LICENSE", "PASSPORT"
  }
  ```

#### `POST /api/v1/users/verification/email`
- **Explanation:** Confirms email verification for the authenticated user.
- **Request Body:**
  ```json
  {
    "email": "customer@dart.ng",
    "code": "123456"
  }
  ```

#### `POST /api/v1/users/verification/phone`
- **Explanation:** Confirms phone verification for the authenticated user.
- **Request Body:**
  ```json
  {
    "phoneNumber": "+2348012345678",
    "code": "123456"
  }
  ```

---

## 4. Riders & Availability (`/riders`)

### Endpoint Overview
| Method | Endpoint | Access | Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/riders/available` | Public | Discover active, online, verified riders near coordinates |
| `GET` | `/riders/profile` | Rider / Admin | Get rider vehicle info, ratings, and active order |
| `PATCH` | `/riders/profile` | Rider | Update vehicle type, plate number, or license |
| `POST` | `/riders/availability` | Rider | Set availability status (`ONLINE`, `OFFLINE`, `BUSY`) |
| `POST` | `/riders/location` | Rider | Send periodic GPS location beacon |

---

### Detailed Endpoint Explanations

#### `GET /api/v1/riders/available`
- **Explanation:** Returns a list of currently online, verified, and available riders. Optionally filters by customer pickup coordinates and maximum radius in kilometers.
- **Access:** Public.
- **Query Parameters:**
  - `latitude` or `lat` (number): Customer pickup latitude.
  - `longitude` or `lng` (number): Customer pickup longitude.
  - `maxDistanceKm` (number): Search radius limit (e.g. `10`).

#### `GET /api/v1/riders/profile`
- **Explanation:** Fetches the authenticated rider's profile, including verification status, vehicle specifications, total completed deliveries, and rolling rating score.
- **Access:** Bearer Token (Role: `RIDER` or `ADMIN`).

#### `PATCH /api/v1/riders/profile`
- **Explanation:** Updates rider vehicle registration details.
- **Request Body:**
  ```json
  {
    "vehicleType": "MOTORCYCLE", // "BICYCLE", "MOTORCYCLE", "CAR", "VAN", "TRUCK"
    "plateNumber": "KJA-123XY",
    "licenseNumber": "LAG-LIC-9821"
  }
  ```

#### `POST /api/v1/riders/availability`
- **Explanation:** Allows a rider to toggle their dispatch availability status.
- **Request Body:**
  ```json
  {
    "status": "ONLINE" // "ONLINE", "OFFLINE", "BUSY"
  }
  ```

#### `POST /api/v1/riders/location`
- **Explanation:** Ingests live telemetry beacon from the rider app to keep position up to date for dispatch matching and live in-transit tracking.
- **Request Body:**
  ```json
  {
    "latitude": 6.4474,
    "longitude": 3.4723
  }
  ```

---

## 5. Pricing & Delivery Quotes (`/orders`)

### Endpoint Overview
| Method | Endpoint | Access | Summary |
| :--- | :--- | :--- | :--- |
| `POST` | `/orders/quote` | Public | Calculate authoritative delivery fee quote |

#### `POST /api/v1/orders/quote`
- **Explanation:** Authoritative server-side pricing engine. Computes delivery quote based on pickup/dropoff coordinates, distance in km, package weight, fragile/sensitive flags, surge multipliers, platform fees, and rider settlement share.
- **Access:** Public.
- **Request Body:**
  ```json
  {
    "pickupLat": 6.4474,
    "pickupLng": 3.4723,
    "destinationLat": 6.5244,
    "destinationLng": 3.3792,
    "weightKg": 2.5,
    "category": "PARCEL",     // "DOCUMENT", "PARCEL", "FOOD", "BULK", "FRAGILE"
    "isFragile": false,
    "isSensitive": false
  }
  ```
- **Response Example:**
  ```json
  {
    "basePrice": 1000,
    "distancePrice": 1200,
    "weightPrice": 300,
    "surgePrice": 0,
    "totalPrice": 2500,
    "platformFee": 375,
    "riderSettlementFee": 2125,
    "distanceKm": 8.4,
    "estimatedMinutes": 32,
    "expiresAt": "2026-10-25T17:15:00.000Z"
  }
  ```

---

## 6. Packages & Inbound Shipments (`/packages`)

### Endpoint Overview
| Method | Endpoint | Access | Summary |
| :--- | :--- | :--- | :--- |
| `POST` | `/packages` | Authenticated | Create a package and draft an associated delivery order |
| `GET` | `/packages` | Authenticated | List all packages created by authenticated user |
| `POST` | `/packages/inbound` | Authenticated | Link an external parcel (SpeedAF, GIG) by tracking ID |
| `GET` | `/packages/inbound` | Authenticated | List all linked external inbound packages |
| `GET` | `/packages/inbound/track/:trackingId` | Public | Live tracking milestones for inbound parcels |
| `GET` | `/packages/inbound/:id` | Authenticated | Get single linked inbound package details |
| `DELETE` | `/packages/inbound/:id` | Authenticated | Unlink an external inbound package from dashboard |
| `GET` | `/packages/:id` | Authenticated | Get package details with addresses and order status |

---

### Detailed Endpoint Explanations

#### `POST /api/v1/packages`
- **Explanation:** Creates a new package entry, persists pickup and destination address details, item manifests, estimated insurance value, and automatically drafts an associated delivery order ready for rider selection.
- **Request Body:**
  ```json
  {
    "name": "Important Contract Documents & Device",
    "description": "Handle with care, fragile glass inside.",
    "category": "PARCEL",
    "weightKg": 2.5,
    "isFragile": true,
    "isSensitive": false,
    "photoUrl": "https://cdn.dart.ng/packages/pkg-9812.jpg",
    "valueAmount": 50000,
    "items": [
      {
        "name": "Apple MacBook Pro",
        "quantity": 1,
        "unitPrice": 1500000
      }
    ],
    "pickupAddress": {
      "street": "15 Admiralty Way, Lekki",
      "city": "Lagos",
      "latitude": 6.4474,
      "longitude": 3.4723
    },
    "destinationAddress": {
      "street": "Broad Street, Marina",
      "city": "Lagos",
      "latitude": 6.5244,
      "longitude": 3.3792
    },
    "senderName": "David Alabi",
    "senderPhone": "+2348011223344",
    "recipientName": "Sarah Jenkins",
    "recipientPhone": "+2348099887766",
    "paymentMethod": "WALLET"
  }
  ```

#### `GET /api/v1/packages`
- **Explanation:** Returns all outgoing packages created by the current authenticated customer.

#### `POST /api/v1/packages/inbound`
- **Explanation:** Links an external eCommerce/courier shipment (e.g. AliExpress via SpeedAF, GIG Logistics, DHL) to the user's dashboard using a waybill/tracking ID.
- **Request Body:**
  ```json
  {
    "trackingId": "NG021358672334",
    "title": "SpeedAF Inbound Package",
    "courier": "SpeedAF Express",
    "store": "AliExpress",
    "fromLocation": "Nigeria Clearance Hub",
    "toLocation": "Distribution DC-BNI CENTRAL",
    "pickupTerminal": "GIG Terminal, Auchi, Edo state"
  }
  ```

#### `GET /api/v1/packages/inbound`
- **Explanation:** Lists all linked external shipments with live arrival estimates and customs/clearance statuses.

#### `GET /api/v1/packages/inbound/track/:trackingId`
- **Explanation:** Public milestone lookup endpoint for inbound parcels.
- **URL Parameter:** `trackingId` (e.g. `NG021358672334`).

#### `GET /api/v1/packages/inbound/:id`
- **Explanation:** Returns complete tracking details and route checkpoints for a linked inbound shipment.
- **URL Parameter:** `id` (inbound parcel UUID).

#### `DELETE /api/v1/packages/inbound/:id`
- **Explanation:** Unlinks and removes an external inbound package from the customer's dashboard.
- **URL Parameter:** `id` (inbound parcel UUID).

#### `GET /api/v1/packages/:id`
- **Explanation:** Retrieves single outgoing package record, item manifest, pickup/dropoff addresses, and current delivery state.
- **URL Parameter:** `id` (package UUID).

---

## 7. Orders & Delivery Lifecycle (`/orders`)

### Endpoint Overview
| Method | Endpoint | Access | Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/orders` | Authenticated | List all orders for current user (customer or rider) |
| `GET` | `/orders/:id` | Authenticated | Get full order details, addresses, and pricing |
| `GET` | `/orders/:id/live-status` | Authenticated | Real-time delivery status, ETA, and rider location |
| `POST` | `/orders/:id/select-rider` | Customer | Customer selects an available rider |
| `POST` | `/orders/:id/accept-rider` | Authenticated | Trigger or simulate rider acceptance |
| `POST` | `/orders/:id/reassign-rider` | Customer | Reassign to an alternative rider after wait timeout |
| `POST` | `/orders/:id/extend-wait` | Customer | Extend countdown waiting window for selected rider |
| `POST` | `/orders/:id/accept` | Rider | Rider accepts assigned delivery assignment |
| `POST` | `/orders/:id/pickup` | Rider | Rider marks package picked up & generates 6-digit PIN |
| `POST` | `/orders/:id/confirm-delivery` | Rider | Rider submits 6-digit handover PIN to settle order |
| `POST` | `/orders/:id/cancel` | Authenticated | Cancel active order and release wallet holds |
| `GET` | `/orders/:id/handover-code` | Customer | Customer views authoritative 6-digit handover PIN |
| `POST` | `/orders/:id/confirm-receipt` | Customer | Customer acknowledges delivery completion |
| `DELETE` | `/orders/:id` | Customer | Remove completed or cancelled order from history |

---

### Detailed Endpoint Explanations

#### `GET /api/v1/orders`
- **Explanation:** Lists all orders belonging to the authenticated user. If caller is a customer, returns their requested deliveries. If caller is a rider, returns their assigned delivery runs.

#### `GET /api/v1/orders/:id`
- **Explanation:** Retrieves single order information, including route coordinates, package details, itemized price breakdown, assigned rider profile, and payment status.
- **URL Parameter:** `id` (order UUID).

#### `GET /api/v1/orders/:id/live-status`
- **Explanation:** Real-time polling endpoint for live tracking. Returns current state-machine status, rider coordinates, bearing, estimated arrival time (ETA), and progress milestones.
- **URL Parameter:** `id` (order UUID).

#### `POST /api/v1/orders/:id/select-rider`
- **Explanation:** Customer selects an available rider. Transitions order state from `DRAFT`/`RIDER_REQUESTED` to `RIDER_SELECTED` and starts the rider acceptance window.
- **Access:** Bearer Token (Role: `CUSTOMER`).
- **Request Body:**
  ```json
  {
    "riderProfileId": "clx123abc456" // or "riderId"
  }
  ```

#### `POST /api/v1/orders/:id/accept-rider`
- **Explanation:** Simulates or triggers rider acceptance of a selected order. Moves order state to `RIDER_ACCEPTED`.

#### `POST /api/v1/orders/:id/reassign-rider`
- **Explanation:** Allows customer to pick another online rider if the previously selected rider declines or times out.
- **Access:** Bearer Token (Role: `CUSTOMER`).
- **Request Body:**
  ```json
  {
    "riderId": "clx999xyz123"
  }
  ```

#### `POST /api/v1/orders/:id/extend-wait`
- **Explanation:** Extends waiting duration countdown for the currently chosen rider by 60 seconds.
- **Access:** Bearer Token (Role: `CUSTOMER`).

#### `POST /api/v1/orders/:id/accept`
- **Explanation:** Rider accepts an assigned delivery task. Advances order status to `RIDER_ACCEPTED` / `PICKUP_PENDING`.
- **Access:** Bearer Token (Role: `RIDER`).

#### `POST /api/v1/orders/:id/pickup`
- **Explanation:** Rider marks package as picked up at the sender's location. Advances status to `IN_TRANSIT`, records pickup timestamp, and securely generates a cryptographically hashed 6-digit handover delivery PIN.
- **Access:** Bearer Token (Role: `RIDER`).

#### `POST /api/v1/orders/:id/confirm-delivery`
- **Explanation:** Rider submits the 6-digit handover PIN provided by the recipient. The server verifies the SHA-256 hash. Upon match:
  1. Marks order as `DELIVERED` and `SETTLED`.
  2. Atomically releases the customer's escrow hold in the double-entry ledger.
  3. Credits rider settlement earnings to the rider's wallet.
  4. Credits platform fee to DART operating account.
- **Access:** Bearer Token (Role: `RIDER`).
- **Request Body:**
  ```json
  {
    "code": "839201",
    "latitude": 6.5244,
    "longitude": 3.3792
  }
  ```

#### `POST /api/v1/orders/:id/cancel`
- **Explanation:** Cancels an order before pickup. Releases active wallet escrow holds, frees assigned rider, and stores cancellation reason.
- **Request Body:**
  ```json
  {
    "reason": "Recipient requested rescheduled delivery date"
  }
  ```

#### `GET /api/v1/orders/:id/handover-code`
- **Explanation:** Customer views the 6-digit handover delivery PIN to provide to the rider upon receiving the package.
- **Access:** Bearer Token (Role: `CUSTOMER`).

#### `POST /api/v1/orders/:id/confirm-receipt`
- **Explanation:** Customer confirms physical receipt of the delivered package.
- **Access:** Bearer Token (Role: `CUSTOMER`).

#### `DELETE /api/v1/orders/:id`
- **Explanation:** Archives or deletes a completed or cancelled order record from the customer view.
- **Access:** Bearer Token (Role: `CUSTOMER`).

---

## 8. Payments & Saved Cards (`/payments`)

### Endpoint Overview
| Method | Endpoint | Access | Summary |
| :--- | :--- | :--- | :--- |
| `POST` | `/orders/:id/payment` | Authenticated | Initiate payment for an order (Wallet, Card, COD) |
| `POST` | `/payments/webhook` | Public | Process payment gateway webhooks (Paystack) |
| `GET` | `/payments/methods` | Authenticated | Get wallet balance, saved cards, and payment options |
| `GET` | `/payments/cards` | Authenticated | List all saved payment cards |
| `POST` | `/payments/cards` | Authenticated | Save and tokenize a new card |
| `PATCH` | `/payments/cards/:id/default` | Authenticated | Set a card as the default payment method |
| `DELETE` | `/payments/cards/:id` | Authenticated | Delete a saved card |

---

### Detailed Endpoint Explanations

#### `POST /api/v1/orders/:id/payment`
- **Explanation:** Processes payment for an order.
  - **`WALLET`**: Places an escrow hold on customer's wallet balance.
  - **`CARD`**: Charges tokenized card or generates Paystack checkout authorization URL.
  - **`CASH_ON_DELIVERY`**: Validates COD eligibility and flags order for cash collection upon delivery.
- **Request Body:**
  ```json
  {
    "paymentMethod": "WALLET", // "WALLET", "CARD", "CASH_ON_DELIVERY"
    "callbackUrl": "https://dart.ng/orders/callback",
    "idempotencyKey": "IDEMP-PAY-81928471"
  }
  ```

#### `POST /api/v1/payments/webhook`
- **Explanation:** Receives asynchronous webhook events from Paystack. Validates HMAC SHA-512 signature in `x-paystack-signature` header, confirms transactions, and fulfills wallet funding or order payments.
- **Headers:** `x-paystack-signature: <signature>`
- **Access:** Public (Signature Verified).

#### `GET /api/v1/payments/methods`
- **Explanation:** Aggregates payment overview for the user: current available wallet balance, list of saved cards, and cash-on-delivery availability.

#### `GET /api/v1/payments/cards`
- **Explanation:** Retrieves all saved debit/credit cards (masked PAN, card brand/scheme, expiration month/year, default indicator).

#### `POST /api/v1/payments/cards`
- **Explanation:** Tokenizes and saves a debit/credit card for future one-tap order checkout.
- **Request Body:**
  ```json
  {
    "cardNumber": "5399410012345678",
    "cardHolder": "John Doe",
    "expiry": "08/28",
    "cvv": "123",
    "setAsDefault": true
  }
  ```

#### `PATCH /api/v1/payments/cards/:id/default`
- **Explanation:** Marks a specific saved card as default payment method and unsets previous default.
- **URL Parameter:** `id` (card UUID).

#### `DELETE /api/v1/payments/cards/:id`
- **Explanation:** Deletes a saved card from user profile.
- **URL Parameter:** `id` (card UUID).

---

## 9. Wallet & Double-Entry Ledger (`/wallet`)

### Endpoint Overview
| Method | Endpoint | Access | Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/wallet` | Authenticated | Get current wallet balance, locked balance, and currency |
| `POST` | `/wallet/deposit` | Authenticated | Fund wallet balance via card payment |
| `POST` | `/wallet/withdraw` | Authenticated | Payout funds to a Nigerian bank account |
| `GET` | `/wallet/transactions` | Authenticated | Get auditable double-entry transaction history |

---

### Detailed Endpoint Explanations

#### `GET /api/v1/wallet`
- **Explanation:** Returns customer or rider wallet details: `availableBalance`, `lockedBalance` (funds held in escrow for active deliveries), `totalBalance`, and currency code (`NGN`).
- **Response Example:**
  ```json
  {
    "walletId": "wlt_9182371",
    "availableBalance": 45000,
    "lockedBalance": 2500,
    "totalBalance": 47500,
    "currency": "NGN",
    "status": "ACTIVE"
  }
  ```

#### `POST /api/v1/wallet/deposit`
- **Explanation:** Initiates wallet top-up. Creates an immutable ledger entry crediting the user's wallet once transaction succeeds.
- **Request Body:**
  ```json
  {
    "amount": 5000,                         // Minimum: 100 NGN
    "paymentMethod": "CARD",
    "idempotencyKey": "IDEMP-DEP-18293849"  // Optional
  }
  ```

#### `POST /api/v1/wallet/withdraw`
- **Explanation:** Withdraws cleared earnings from wallet to an external bank account (primarily for riders and merchants). Validates available non-locked balance and creates a debit ledger transaction.
- **Request Body:**
  ```json
  {
    "amount": 10000,                         // Minimum: 500 NGN
    "bankCode": "058",                       // e.g. GTBank 058
    "bankName": "Guaranty Trust Bank",
    "accountNumber": "0123456789",
    "accountName": "Chidi Okonkwo",
    "idempotencyKey": "IDEMP-WTD-91823746"
  }
  ```

#### `GET /api/v1/wallet/transactions`
- **Explanation:** Returns complete chronological audit trail of all ledger transactions (deposits, escrow holds, releases, rider earnings, withdrawals) with timestamps, reference IDs, and before/after balances.

---

## 10. Public Milestone Tracking (`/tracking`)

### Endpoint Overview
| Method | Endpoint | Access | Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/tracking/:trackingId` | Public | Public package and milestone tracking lookup |

#### `GET /api/v1/tracking/:trackingId`
- **Explanation:** Allows senders, recipients, or third parties to query shipment status using a tracking ID (e.g. `TRK-839210`) without authenticating. Returns chronological milestones (Order Created, Rider Assigned, Picked Up, In Transit, Delivered) and route checkpoints without leaking private customer credentials.
- **Access:** Public.
- **URL Parameter:** `trackingId`.
- **Response Example:**
  ```json
  {
    "trackingId": "TRK-839210",
    "status": "IN_TRANSIT",
    "package": {
      "name": "Electronics & Documents",
      "category": "PARCEL"
    },
    "originCity": "Lagos",
    "destinationCity": "Benin City",
    "milestones": [
      { "event": "ORDER_CREATED", "timestamp": "2026-10-25T14:00:00Z" },
      { "event": "RIDER_ASSIGNED", "timestamp": "2026-10-25T14:15:00Z" },
      { "event": "PICKED_UP", "timestamp": "2026-10-25T14:35:00Z" }
    ]
  }
  ```

---

## 11. Ratings & Reviews (`/ratings`)

### Endpoint Overview
| Method | Endpoint | Access | Summary |
| :--- | :--- | :--- | :--- |
| `POST` | `/ratings` | Authenticated | Submit rating and feedback for completed order |
| `GET` | `/ratings/rider/:riderUserId` | Public | Get rating history, compliments, and average score |

---

### Detailed Endpoint Explanations

#### `POST /api/v1/ratings`
- **Explanation:** Customer submits rating feedback for a completed delivery. Recalculates rider's rolling average rating score and persists qualitative review tags.
- **Request Body:**
  ```json
  {
    "orderId": "clx123orderid",
    "riderUserId": "rider-user-id",          // Optional
    "score": 5,                              // Integer from 1 to 5
    "review": "Very fast pickup and arrived in perfect condition!",
    "tags": ["On-Time", "Polite", "Careful"] // Optional compliment tags
  }
  ```

#### `GET /api/v1/ratings/rider/:riderUserId`
- **Explanation:** Public endpoint returning rider's reputation metrics: rolling star average, total count of completed reviews, and list of customer feedback.
- **URL Parameter:** `riderUserId` (rider's user UUID).

---

## 12. Support & Issue Reporting (`/support`)

### Endpoint Overview
| Method | Endpoint | Access | Summary |
| :--- | :--- | :--- | :--- |
| `POST` | `/support/tickets` | Authenticated | Submit a support ticket or dispute an order |
| `GET` | `/support/tickets` | Authenticated | List all tickets submitted by current user |
| `GET` | `/support/tickets/:id` | Authenticated | Get details and resolution history of a ticket |
| `GET` | `/support/categories` | Public | Get list of supported ticket categories |

---

### Detailed Endpoint Explanations

#### `POST /api/v1/support/tickets`
- **Explanation:** Submits a customer or rider support ticket for dispute resolution, package issues, or app assistance.
- **Request Body:**
  ```json
  {
    "category": "Booking a delivery",
    "subject": "Pickup delay issue",
    "description": "The rider did not arrive at the scheduled pickup point",
    "orderId": "a0b1c2d3-uuid" // Optional associated order
  }
  ```

#### `GET /api/v1/support/tickets`
- **Explanation:** Lists all support tickets filed by the caller, including ticket status (`OPEN`, `INVESTIGATING`, `RESOLVED`, `CLOSED`).

#### `GET /api/v1/support/tickets/:id`
- **Explanation:** Retrieves specific support ticket with admin/support agent resolution messages.
- **URL Parameter:** `id` (ticket UUID).

#### `GET /api/v1/support/categories`
- **Explanation:** Returns available issue categories to populate frontend dropdown selectors.

---

## 13. Notifications (`/notifications`)

### Endpoint Overview
| Method | Endpoint | Access | Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/notifications` | Authenticated | Get user notifications and unread counter |
| `PATCH` | `/notifications/:id/read` | Authenticated | Mark a single notification as read |
| `POST` | `/notifications/read-all` | Authenticated | Mark all notifications as read |
| `DELETE` | `/notifications/:id` | Authenticated | Delete a single notification |
| `DELETE` | `/notifications` | Authenticated | Clear all notifications |

---

### Detailed Endpoint Explanations

#### `GET /api/v1/notifications`
- **Explanation:** Fetches user notifications (e.g. order status changes, payment receipts, escrow releases) with total unread counter.
- **Query Parameters:**
  - `type` (string): Filter by type (`ALL`, `ORDER_UPDATE`, `PAYMENT`, `SYSTEM`).
  - `unreadOnly` (boolean): Set `true` to return only unread notifications.
  - `limit` (number): Max items per page (default: `50`).

#### `PATCH /api/v1/notifications/:id/read`
- **Explanation:** Marks a specific notification as read.
- **URL Parameter:** `id` (notification UUID).

#### `POST /api/v1/notifications/read-all`
- **Explanation:** Marks all unread notifications for the authenticated user as read in bulk.

#### `DELETE /api/v1/notifications/:id`
- **Explanation:** Permanently deletes an individual notification item.
- **URL Parameter:** `id` (notification UUID).

#### `DELETE /api/v1/notifications`
- **Explanation:** Clears and deletes all notifications in the user's inbox.

---

## 14. Chat & Messaging (`/chats`)

### Endpoint Overview
| Method | Endpoint | Access | Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/chats` | Authenticated | List all active conversation threads |
| `GET` | `/chats/:id` | Authenticated | Get conversation contact details |
| `GET` | `/chats/:id/messages` | Authenticated | Retrieve message history for a conversation |
| `POST` | `/chats/:id/messages` | Authenticated | Send message (text, voice note, photo, file) |
| `POST` | `/chats/:id/messages/:messageId/react` | Authenticated | Add or toggle emoji reaction on a message |
| `PATCH` | `/chats/:id/messages/:messageId/pin` | Authenticated | Pin or unpin a message |
| `PATCH` | `/chats/:id/messages/:messageId` | Authenticated | Edit message text |
| `DELETE` | `/chats/:id/messages/:messageId` | Authenticated | Delete a message |
| `DELETE` | `/chats/:id/clear` | Authenticated | Clear all messages in conversation |

---

### Detailed Endpoint Explanations

#### `GET /api/v1/chats`
- **Explanation:** Lists all conversation threads involving the caller, with latest message snippet, unread counter, recipient avatar, and online status.
- **Query Parameters:**
  - `category` (string): Filter category (`All`, `Conversation`, `Updates`, `Supports`).
  - `search` (string): Search contacts by name.

#### `GET /api/v1/chats/:id`
- **Explanation:** Retrieves single chat header, including participant profile info and associated order ID.
- **URL Parameter:** `id` (chat ID or order ID).

#### `GET /api/v1/chats/:id/messages`
- **Explanation:** Fetches chronological messages for a conversation thread.
- **URL Parameter:** `id` (chat ID).
- **Query Parameter:** `limit` (number).

#### `POST /api/v1/chats/:id/messages`
- **Explanation:** Sends a message in a conversation. Supports text messages, voice notes, photos, and file attachments. Automatically broadcasts the message to the recipient via WebSockets.
- **Request Body:**
  ```json
  {
    "type": "text", // "text", "audio", "image", "file"
    "text": "Hello, are you near the pickup location?",
    "audioUrl": "https://cdn.dart.ng/audio/voice-note-1.webm",     // If type is "audio"
    "audioDuration": 4.5,                                          // Duration in seconds
    "imageUrl": "https://cdn.dart.ng/photos/parcel-photo-1.jpg",   // If type is "image"
    "fileName": "delivery-receipt.pdf",                            // If type is "file"
    "fileSize": 1048576,
    "fileUrl": "https://cdn.dart.ng/docs/delivery-receipt.pdf"
  }
  ```

#### `POST /api/v1/chats/:id/messages/:messageId/react`
- **Explanation:** Adds or toggles an emoji reaction (e.g. 👍, ❤️, 📦) on a specific chat message.
- **Request Body:**
  ```json
  {
    "emoji": "👍"
  }
  ```

#### `PATCH /api/v1/chats/:id/messages/:messageId/pin`
- **Explanation:** Pins or unpins a message to the top of the chat room.
- **Request Body:**
  ```json
  {
    "isPinned": true
  }
  ```

#### `PATCH /api/v1/chats/:id/messages/:messageId`
- **Explanation:** Edits text content of a previously sent message.
- **Request Body:**
  ```json
  {
    "text": "Updated message text"
  }
  ```

#### `DELETE /api/v1/chats/:id/messages/:messageId`
- **Explanation:** Deletes a specific message from chat history for both participants.

#### `DELETE /api/v1/chats/:id/clear`
- **Explanation:** Clears all messages within the specified conversation thread.

---

### WebSocket Real-Time Gateway (`/chat`)
- **Gateway Namespace:** `/chat`
- **Client Inbound Events:**
  - `join_chat`: Join room for an active order/chat (`{ "chatId": "order-123" }`).
  - `leave_chat`: Leave chat room.
  - `typing`: Broadcast typing status (`{ "chatId": "...", "isTyping": true, "userName": "David" }`).
- **Server Outbound Broadcast Events:**
  - `new_message`: Pushed to room when a message is saved.
  - `message_reacted`: Pushed when a reaction is updated.
  - `message_pinned`: Pushed when a message is pinned/unpinned.
  - `message_edited`: Pushed when message text is updated.
  - `message_deleted`: Pushed when a message is removed.
  - `user_typing`: Broadcasts recipient typing activity.

---

## 15. Admin & Operations (`/admin`)

### Endpoint Overview
| Method | Endpoint | Access | Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/admin/dashboard` | Admin Only | Metrics, gross volume, revenue, and order totals |
| `GET` | `/admin/audit-logs` | Admin Only | System-wide immutable security and audit log trail |
| `GET` | `/admin/orders/:id/inspect` | Admin Only | Deep audit inspection of order & settlement ledger |
| `PATCH` | `/admin/users/:id/status` | Admin Only | Update user account status (`ACTIVE`, `SUSPENDED`) |

---

### Detailed Endpoint Explanations

#### `GET /api/v1/admin/dashboard`
- **Explanation:** Returns real-time platform statistics for operations: total customer count, online riders, active deliveries, completed orders, gross delivery volume (GDV), and platform commission revenue.
- **Access:** Bearer Token (Role: `ADMIN`).

#### `GET /api/v1/admin/audit-logs`
- **Explanation:** Queries immutable audit log entries recording critical system events, access changes, and administrative actions.
- **Access:** Bearer Token (Role: `ADMIN`).
- **Query Parameters:**
  - `page` (number): Page number (default: `1`).
  - `limit` (number): Items per page (default: `50`).

#### `GET /api/v1/admin/orders/:id/inspect`
- **Explanation:** Provides a deep forensic view of a specific order: state machine transition history, assigned rider telemetry timestamps, escrow hold records, and double-entry ledger entries.
- **Access:** Bearer Token (Role: `ADMIN`).
- **URL Parameter:** `id` (order UUID).

#### `PATCH /api/v1/admin/users/:id/status`
- **Explanation:** Allows administrators to suspend, activate, or deactivate a customer or rider account with a required audit reason.
- **Access:** Bearer Token (Role: `ADMIN`).
- **URL Parameter:** `id` (user UUID).
- **Request Body:**
  ```json
  {
    "status": "SUSPENDED", // "ACTIVE", "SUSPENDED", "DEACTIVATED"
    "reason": "Policy violation regarding delivery non-compliance"
  }
  ```
