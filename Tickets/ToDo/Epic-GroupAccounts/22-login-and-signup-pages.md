# 22 - Login & Signup Pages

## Description
Create the frontend pages for logging in and creating a new group. Add group name and logout button to the navbar on all existing pages.

## Dependencies
Ticket 21 (Groups Table & Auth API)

## Tasks

### Login page (`/login`)
- `views/login.html` — form with group name + password fields
- Submit calls `POST /api/auth/login`, redirects to `/` on success
- Shows error message on failure

### Signup page (`/signup`)
- `views/signup.html` — form with group name + email + password fields
- Submit calls `POST /api/auth/signup`, redirects to `/` on success
- Shows error message on failure (e.g. "Group name already taken")

### Shared auth JS
- `public/js/auth.js` — handles both login and signup form submissions

### Navbar updates
- Show logged-in group name + logout button in navbar on all pages (`index.html`, `bitterballen.html`, `stats.html`, `settings.html`)
- `public/js/navbar.js` — fetches `/api/auth/me`, shows group name, handles logout

## Done when
- User can visit `/signup`, create a group, and land on `/`
- User can visit `/login`, log in, and land on `/`
- Navbar shows group name and logout button on all pages
- Logout redirects to `/login`
- Error messages display for bad credentials or duplicate group names
