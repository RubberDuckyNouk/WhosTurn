# 24 - Scope Data to Groups

## Description
Update all API queries to filter by the logged-in group's `group_id`. Each group only sees its own members, sessions, climbs, and balances.

## Dependencies
Ticket 23 (Migrate Existing Data)

## Tasks

### Attach group to request
- After session middleware, add middleware that loads the group from `req.session.groupId` and attaches it to `req.group` (or just use `req.session.groupId` directly in queries)

### Update all queries
Every query that touches `members`, `sessions`, `session_attendance`, or `climbs` needs a `WHERE group_id = $groupId` filter (or `JOIN` through a group-scoped table). This includes:
- `GET /api/members`
- `GET /api/driving`
- `GET /api/payment`
- `POST /api/sessions` — set `group_id` on new sessions
- `GET /api/sessions` — filter by group
- `DELETE /api/sessions/:id` — verify session belongs to group
- `GET /api/bitterballen-karma`
- `POST /api/climbs` — set `group_id` on new climbs
- `GET /api/climbs` and related endpoints — filter by group
- `DELETE /api/climbs/:id` — verify climb belongs to group
- Member management endpoints in settings

### New members/sessions get group_id
- When creating a member, session, or climb, set `group_id` from the logged-in group

## Done when
- Each group only sees its own data
- Creating new records assigns them to the logged-in group
- Deleting records verifies ownership by group
- Two groups with different data don't see each other's members or sessions
