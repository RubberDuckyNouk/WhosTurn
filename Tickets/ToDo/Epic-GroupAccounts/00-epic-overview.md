# Epic — Group Accounts

## Goal
Support multiple friend groups using the same WhosTurn instance. Each group has a shared account (group name + password). No individual user accounts.

## Design Decisions
- **One account per group** — login with group name + password
- **Public signup** — anyone can create a group (name + password + email)
- **Email collected but not verified** — stored for future self-service password reset
- **Persistent sessions** — 30-day cookie stored in PostgreSQL, survives server restarts
- **All routes gated** — login required for everything except login/signup pages
- **Existing data migrated** — current members/sessions/balances move into a default group

## Ticket Order
1. `21-groups-table-and-auth-api.md` — Database schema + backend auth endpoints
2. `22-login-and-signup-pages.md` — Frontend login/signup + navbar group name & logout
3. `23-migrate-existing-data.md` — Add group_id columns, create default group, backfill
4. `24-scope-data-to-groups.md` — All queries filter by the logged-in group
5. `25-auth-gate.md` — Require login on all routes

## Replaces
Tickets 16–19 in `Tickets/ToDo/` (User Accounts, Groups, Scope Pages, Link Members). Those were designed around individual user accounts — this epic takes a simpler group-account approach.
