# 17 - Groups

## Description
Add the concept of groups. Users can create a group and invite others via an invite link. Groups are the container for members, sessions, payments, and climbing data.

## Dependencies
Ticket 16 (User Accounts)

## What to add

### Database
- `groups` table: `id`, `name`, `invite_code` (unique, random 8-char string), `created_by` (references users), `created_at`
- Add `group_id` column to `members` table (references groups, NOT NULL for new rows)

### Backend (server.js)
- `POST /api/groups` — create a group (requires login). Generate invite code, set created_by to current user.
- `GET /api/groups` — list groups the current user belongs to (user belongs to a group if they have a linked member in it)
- `GET /api/groups/:code` — get group info by invite code
- `POST /api/groups/:code/join` — join a group via invite code. Creates a member row linked to the current user (`user_id` + `group_id`). Uses the user's display name as the member name.

### Frontend
- `views/groups.html` + `public/js/groups.js` — page to list your groups, create a new group, or join via invite code
- `GET /groups` page route
- After login, if user has no groups, redirect to `/groups`
- Group list shows each group name with a link to `/g/:code`

### Data migration
- Create a default group for existing data
- Set `group_id` on all existing members to the default group

## Done when
- Logged-in user can create a group and gets an invite link
- Another user can join via the invite link
- User sees a list of their groups
- Existing data is migrated to a default group
