# Marketplace Auth and Security Notes

## Added Modules

- `models/userModel.js`
  User schema with hashed passwords, password reset tokens, roles, password expiry, and JWT-related helper methods.
- `controllers/authController.js`
  Signup, login, logout, route protection, role authorization, forgot/reset password, and current-session password update.
- `controllers/userController.js`
  Current-session profile read, update, and delete operations using JWT instead of a user ID in the URI.
- `routes/userRoutes.js`
  Auth and current-user endpoints under `/api/v1/users`.
- `utils/email.js`
  Email sender with Mailtrap-ready configuration and a JSON transport fallback that logs the latest email payload to `logs/emails/latest-email.json`.

## Routes Added

- `POST /api/v1/users/signup`
- `POST /api/v1/users/login`
- `GET /api/v1/users/logout`
- `POST /api/v1/users/forgotPassword`
- `PATCH /api/v1/users/resetPassword/:token`
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/updateMyPassword`
- `PATCH /api/v1/users/updateMe`
- `DELETE /api/v1/users/deleteMe`

## Product Security Changes

- `GET /api/v1/products`
  Now requires a valid JWT.
- `GET /api/v1/products/top-3-cheap`
  Now requires a valid JWT because it reuses the protected product listing handler.
- `DELETE /api/v1/products/:id`
  Now requires a valid JWT and an `admin` role.

## App-Wide Security Middleware

- `helmet`
  Adds defensive HTTP headers.
- `express-rate-limit`
  Applies rate limiting to `/api`.
- `cookie-parser`
  Reads JWT from cookies in addition to Bearer tokens.
- `express-mongo-sanitize`
  Removes MongoDB operator injection payloads.
- `xss-clean`
  Sanitizes HTML/script input.
- `hpp`
  Blocks HTTP parameter pollution by collapsing duplicate query parameters.

## Environment Variables

Add these to `config.env` if you want to customize behavior further:

- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `JWT_COOKIE_EXPIRES_IN`
- `PASSWORD_EXPIRY_DAYS`
- `RATE_LIMIT_MAX`
- `RATE_LIMIT_WINDOW_MS`
- `EMAIL_FROM`
- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_USERNAME`
- `EMAIL_PASSWORD`

## Verification

Run:

```bash
npm run verify:auth
```

Outputs:

- `verification-auth-output.json`
- `AUTH_SECURITY_VERIFICATION.md`

These files capture the requested route and security checks, including:

- unauthenticated access rejection
- authenticated product access
- invalid and expired token handling
- deleted-user token handling
- expired-password handling
- admin-only delete authorization
- forgot/reset password flow
- current-session password update
- current-session profile update
- current-session delete
- cookie header capture
- Helmet and rate-limit headers
- XSS sanitization
- HPP duplicate-sort behavior
