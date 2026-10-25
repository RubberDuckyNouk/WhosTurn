# 21 - Groups Table & Auth API

## Description
Create the `groups` table and all backend auth endpoints. This is the foundation — no frontend yet, just the API and session infrastructure.

## Dependencies
None (first ticket in the epic).

## Tasks
- Create `groups` table: `id`, `name` (unique), `email`, `password_hash`, `created_at`
- Configure `express-session` with `connect-pg-simple` (store sessions in PostgreSQL)
- 30-day session cookie, httpOnly, secure in production
- Add `SESSION_SECRET` to `.env`
- `POST /api/auth/signup` — create a group (name + email + password). Hash password with bcrypt. Log in automatically after creation.
- `POST /api/auth/login` — log in with group name + password. Store `groupId` in session.
- `POST /api/auth/logout` — destroy session, clear cookie.
- `GET /api/auth/me` — return the logged-in group (id, name, email) or 401.
- Define `requireLogin` middleware (not applied to routes yet — that's ticket 25).

## Done when
- A group can be created via the API with name, email, and password
- Password is stored hashed (never plain text)
- Login returns group info and sets a session cookie
- Session persists across server restarts (stored in PostgreSQL)
- `/api/auth/me` returns the group when logged in, 401 when not
- Logout destroys the session
- Duplicate group names are rejected
