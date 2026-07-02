# 20 - Global Stats

## Description
Add a public (no login required) app-wide statistics page that aggregates climbing data across all groups.

## Dependencies
Ticket 18 (Scope Pages to Groups)

## What to add

### Backend
- `GET /api/stats/global` — returns aggregated stats across all groups:
  - Total climbs logged (all time)
  - Total active groups (groups with at least one climb this month)
  - Total users
  - Top 10 highest grades this month (with user display name and grade)
  - Most active climbers this month (by route count, top 10)
  - Grade distribution this month (count per grade)

### Frontend
- `views/global-stats.html` + `public/js/global-stats.js`
- `GET /explore` page route
- Cards/tables showing the stats above
- Optionally a chart for grade distribution (reuse Chart.js)
- No login required — this page is public

### Navigation
- Add "Explore" link to the navbar on all pages (visible whether logged in or not)
- On the groups list page, add a link to explore

## Done when
- `/explore` shows app-wide statistics
- Page is accessible without logging in
- Stats update as new climbs are logged across any group
