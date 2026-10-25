# 25 - Auth Gate

## Description
Apply the `requireLogin` middleware to all routes so unauthenticated users can only access the login and signup pages.

## Dependencies
Ticket 22 (Login & Signup Pages)

## Tasks

### Apply middleware
- Add `requireLogin` to all page routes (`/`, `/bitterballen`, `/stats`, `/settings`)
- Add `requireLogin` to all API routes (`/api/members`, `/api/driving`, `/api/payment`, `/api/sessions`, `/api/climbs`, etc.)
- Exclude: `/login`, `/signup`, `/api/auth/login`, `/api/auth/signup`, and static assets (`/css`, `/js`, `/images`)

### Redirect for page requests
- If a page route is hit without a session, redirect to `/login` instead of returning JSON 401
- API routes still return 401 JSON (frontend handles this)

### Frontend handling
- If any fetch call gets a 401, redirect to `/login`

## Done when
- Visiting any page without being logged in redirects to `/login`
- API calls without a session return 401
- Login and signup pages are accessible without a session
- Static assets (CSS, JS, images) load without a session
- After logging in, user lands on `/` with full access
