# NETLINK — Backend
REST API for the Netlink social platform. Built with Node.js, Express 5, TypeScript, Prisma, and PostgreSQL.

## Tech Stack
- **Runtime & Framework:** Node.js & Express.js (v5)
- **Language:** TypeScript
- **Validation Engine:** Zod (Runtime Schema Validation & z.infer Type Inferrer)
- **Database & ORM:** PostgreSQL & Prisma ORM
- **Authentication:** JWT (JSON Web Tokens) in Secure HttpOnly Cookies
- **Security:** Helmet (HSTS, CSP, X-Frame-Options) & Rate Limiting (Redis / In-Memory)

---

## Project Structure
`	ext
netlink-api/
├── src/
│   ├── config/          # Prisma client & database configuration
│   ├── controllers/     # Route controllers & business orchestration
│   ├── middleware/      # Auth, Rate limit, Validation & Centralized Error Handler
│   ├── routes/          # Express route definitions
│   ├── schemas/         # Shared Zod validation schemas & inferred types
│   ├── services/        # Business logic, JWT & hashing services
│   ├── utils/           # AppError hierarchy, cookie helpers & automated test suites
│   ├── app.ts           # Express application setup
│   └── server.ts        # Server entry point
`

---

## Authentication & Cookie Security Architecture (HttpOnly)

Netlink implements **HttpOnly Cookie Authentication** to protect JWTs against Cross-Site Scripting (XSS) token exfiltration attacks.

`	ext
  [Browser / Vue Client]                      [Express API Server]
            │                                           │
            ├─────── POST /auth/login (credentials) ───►│
            │                                           ├─ Verify credentials & sign JWT
            │◄────── 200 OK + Set-Cookie: auth_token ───┤ (HttpOnly, Secure, SameSite)
            │        { "user": { ... } }                │
            │                                           │
    [Cookie stored in                                   │
     Browser Cookie Jar]                                │
            │                                           │
            ├─────── GET /post/all ────────────────────►│
            │        (Browser automatically attaches    ├─ cookieParser() parses req.cookies
            │         Cookie: auth_token=...)           ├─ authenticate middleware verifies JWT
            │◄────── 200 OK + Data ─────────────────────┤
            │                                           │
            ├─────── POST /auth/logout ────────────────►│
            │◄────── 200 OK + Clear-Cookie ─────────────┤ res.clearCookie('auth_token')
`

### 1. Security Attributes Breakdown
- **httpOnly: true**: Blocks client-side JavaScript (document.cookie) from reading the cookie, eliminating direct token exfiltration via XSS.
- **secure: isProduction**: Enforces transmission over encrypted HTTPS connections in production (	rue), while allowing local development on HTTP (alse).
- **sameSite: isProduction ? 'none' : 'lax'**:
  - In **Production**: Configured to 'none' because frontend (
etlify.app) and backend (onrender.com / custom host) live on different domains (cross-site). Requires secure: true.
  - In **Development**: Configured to 'lax' on localhost.
- **path: '/'**: Ensures the authentication cookie is attached across all API endpoints.
- **maxAge: 3600000 (1 hour)**: Synchronized with JWT expiration (JWT_EXPIRES_IN = '1h').

### 2. CORS & Credentials
Cross-origin cookie delivery requires explicit mutual configuration:
- **Backend Express CORS**: credentials: true with strict whitelist of allowed origins (wildcard * is forbidden with credentials).
- **Frontend Axios**: withCredentials: true globally configured on pi.ts.

---

## Request Validation Architecture (Zod)

Netlink implements a declarative **Zod Validation & Type-Inference Architecture** acting as the single source of truth across the API boundary.

`	ext
  [HTTP Request with Body]
             │
             ▼
  1. Route Middleware Chain (Rate Limit ──► Auth)
             │
             ▼
  2. validateRequest(schema) (Security & Trust Boundary)
         ├── [Invalid Body] ──► next(new BadRequestError(message, details))
         │                              │
         │                              ▼
         │                       errorHandler (400 Bad Request JSON)
         │
         └── [Valid Body] ────► req.body = sanitized/defaulted data
                                        │
                                        ▼
  3. Controller (Clean Business Logic + Typed with Inferred Types)
             │
             ▼
  4. Service / Prisma (Database Operations)
`

### 1. Schemas & Inferred Types (src/schemas/)
- **egisterSchema & RegisterInput (src/schemas/auth.schema.ts)**:
  - Enforces email format, name character bounds (/^[A-Za-zÀ-ÿ ]{2,40}$/), and strict password complexity (min 8 chars, uppercase, lowercase, numbers, symbols).
  - Exports compile-time TypeScript type: export type RegisterInput = z.infer<typeof registerSchema>;
- **loginSchema & LoginInput (src/schemas/auth.schema.ts)**:
  - Validates presence and formatting of credentials.
  - Exports compile-time TypeScript type: export type LoginInput = z.infer<typeof loginSchema>;
- **createPostSchema & CreatePostInput (src/schemas/post.schema.ts)**:
  - Validates non-empty trimmed content (max 2000 chars), allowed visibility states (PUBLIC, FOLLOWERS, ONLY_ME, SPECIFIC).
  - Implements .superRefine() to conditionally enforce that specificFollowers is populated when isibility === 'SPECIFIC'.
  - Exports compile-time TypeScript type: export type CreatePostInput = z.infer<typeof createPostSchema>;

### 2. Validation Middleware (alidateRequest)
Located at src/middleware/validate.ts:
- Validates eq.body using schema.safeParse().
- **On Success:** Replaces eq.body with parsed, trimmed, and default-applied data, then invokes 
ext(). Mass assignment attacks are prevented as unknown fields are automatically stripped.
- **On Failure:** Formats structured field-level errors ([{ field, message }]) and passes a BadRequestError (400) directly into the centralized error handler.

### 3. Route Integration
Validation middleware is mounted at the route boundary across all body-accepting endpoints:
- POST /auth/register $\rightarrow$ uthRateLimiter, alidateRequest(registerSchema), egister
- POST /auth/login $\rightarrow$ uthRateLimiter, alidateRequest(loginSchema), login
- POST /posts/ $\rightarrow$ uthenticate, alidateRequest(createPostSchema), createPost

---

## Centralized Error Handling Architecture

Powered by a custom AppError class hierarchy and a 4-parameter Express 5 error middleware:

### 1. Error Classification
- **Operational Errors (AppError):** Predictable, known runtime errors (e.g. invalid inputs, expired tokens, resource conflicts). Handled with explicit HTTP status codes and user-friendly error messages.
  - BadRequestError (400) — Validation failures and malformed requests
  - UnauthorizedError (401) — Missing, invalid, or expired tokens / bad credentials
  - ForbiddenError (403) — Permission and authorization violations
  - NotFoundError (404) — Missing resources or unhandled route paths
  - ConflictError (409) — Duplicate email or resource conflicts
  - InternalServerError (500) — Explicit operational server failure
- **Programmer Errors:** Unexpected system bugs (e.g. TypeError, database connection loss). Logged with full stack traces in server logs, but sanitized to safe 500 Internal Server Error responses in production.

### 2. Standardized Error Response Format

`json
{
  "status": "fail",
  "error": "Email: Invalid email address format.",
  "details": [
    {
      "field": "email",
      "message": "Invalid email address format."
    }
  ]
}
`

- In **Development Mode** (NODE_ENV !== 'production'), error responses include full debugging details (statusCode, stack, and raw details).
- In **Production Mode** (NODE_ENV === 'production'), stack traces are completely stripped and unexpected internal errors are sanitized.

### 3. Automatic Third-Party Error Mapping
The centralized error middleware automatically intercepts and converts:
- **Prisma P2002** (Unique constraint failure) $\rightarrow$ 409 Conflict
- **Prisma P2025** (Record not found) $\rightarrow$ 404 Not Found
- **JsonWebTokenError / TokenExpiredError** $\rightarrow$ 401 Unauthorized
- **Express Body-Parser SyntaxError** $\rightarrow$ 400 Bad Request

---

## Setup & Running

`ash
# Install dependencies
npm install

# Start development server with hot-reload
npm run dev

# Run automated test suites (Error Handling + Zod Validation + Auth Cookies)
npm test

# Build for production
npm run build

# Start production server
npm start
`

---

## Environment Variables
Create a .env file in 
etlink-api/:

`env
DATABASE_URL="postgresql://..."
JWT_SECRET="your-secure-jwt-secret"
CORS_ORIGIN="http://localhost:5173"
NODE_ENV="development"
`

---

## License
MIT
