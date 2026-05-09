# Auth and Security Verification

## Runtime

- Generated: 2026-04-18T07:02:55.563Z
- Database connected: true
- Email transport used: mailtrap

## Key Outcomes

- Unauthenticated `GET /api/v1/products`: 401 (You are not logged in. Please log in to get access.)
- Authenticated `GET /api/v1/products`: 200
- Invalid token response: 401 (Invalid token.)
- Expired token response: 401 (Your token has expired.)
- Deleted-user token response: 401 (The user that owns this token no longer exists.)
- Expired-password response: 401 (Your password has expired. Please reset or update your password.)
- Normal user delete attempt: 403 (You do not have permission to perform this action.)
- Admin delete attempt: 204
- Forgot password email token captured: 107760fe856ac9e561654396a7167b46bebe1c9878ba140d7156cf6c1b5e3705
- Reset password response: 200
- Update current password response: 200
- Update current details response: 200
- Delete current user response: 204

## Header Evidence

- Rate limit headers: limit=100, remaining=74
- Helmet CSP present: true
- Helmet frame protection: SAMEORIGIN

## Cookie Evidence

- Signup Set-Cookie header: jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZTMyYzllYmJkMmFmNWQyNDhkYWFjOSIsImlhdCI6MTc3NjQ5NTc3NCwiZXhwIjoxNzc2NDk5Mzc0fQ.MYiHHARXgEVSg_yWypf6BxjDgShpkr-TMgmX0VCLjtU; Path=/; Expires=Sat, 25 Apr 2026 07:02:54 GMT; HttpOnly; SameSite=Lax

## Sanitization and HPP

- XSS-sanitized name result: &lt;script>alert("xss")&lt;/script>Clean User
- HPP duplicate sort status: 200
- HPP duplicate sort first product: Thermal Paste Syringe

## Notes

- Mailtrap-ready transport is supported through `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USERNAME`, and `EMAIL_PASSWORD`.
- In this run, the email transport recorded was `mailtrap`, and the latest email payload is stored in `logs/emails/latest-email.json`.
- Full structured output is saved in `verification-auth-output.json`.
