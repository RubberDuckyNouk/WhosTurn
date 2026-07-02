# 18 - Scope Pages to Groups

## Description
Move all existing pages (home, bitterballen, stats) under a group URL prefix (`/g/:code/...`). All API calls become group-scoped. Only group members can access group pages.

## Dependencies
Ticket 17 (Groups)

## What to add

### Routing
Change page routes from:
- `/` → `/g/:code`
- `/bitterballen` → `/g/:code/bitterballen`
- `/stats` → `/g/:code/stats`

The root `/` becomes the groups list (or redirects to `/groups`).

### API changes
All group-scoped API endpoints move under `/api/groups/:code/...`:
- `/api/members` → `/api/groups/:code/members`
- `/api/driving` → `/api/groups/:code/driving`
- `/api/payment` → `/api/groups/:code/payment`
- `/api/sessions` → `/api/groups/:code/sessions`
- `/api/climbs` → `/api/groups/:code/climbs`
- `/api/climbs/current` → `/api/groups/:code/climbs/current`
- `/api/climbs/recent` → `/api/groups/:code/climbs/recent`
- `/api/climbs/stats` → `/api/groups/:code/climbs/stats`
- `/api/climbs/top-average` → `/api/groups/:code/climbs/top-average`
- `/api/grades` stays global (not group-specific)

### Middleware
- Group auth middleware: resolve `:code` to a group, verify the current user is a member of that group, attach group to `req`. Return 403 if not a member.
- Pass `group_id` into all queries that currently query `members` without a group filter.

### Frontend
- All fetch URLs in `app.js`, `bitterballen.js`, `stats.js` need to use the group code from the current URL (e.g. `window.location.pathname.split("/")[2]`)
- Navbar links update to include the group prefix

## Done when
- All pages and APIs are scoped to a group via `/g/:code`
- A user who is not a member of a group gets a 403
- Existing functionality works identically, just under the new URL structure
