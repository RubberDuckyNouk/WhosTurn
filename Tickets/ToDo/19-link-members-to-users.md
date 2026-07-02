# 19 - Link Members to Users

## Description
Connect member records to user accounts. When a user joins a group, their member row gets a `user_id`. This enables personal climb logging (you can only log climbs for yourself) while keeping payments open to anyone.

## Dependencies
Ticket 18 (Scope Pages to Groups)

## What to add

### Database
- Add `user_id` column to `members` table (references users, nullable — unlinked members can still exist for payment/driving purposes)

### Group member management
- `POST /api/groups/:code/members` — add an unlinked member to the group (just a name, for payment rotation). Requires login + group membership.
- When a user joins a group (ticket 17's join endpoint), check if an unlinked member with a matching name exists and link it. Otherwise create a new member row.

### Climb logging restriction
- `POST /api/groups/:code/climbs` — change to use the logged-in user's linked member_id instead of accepting `member_id` from the request body. Return 403 if the user has no linked member in the group.
- `DELETE /api/groups/:code/climbs/:id` — only allow deleting your own climbs (the climb's member_id must match the user's linked member).

### Frontend (bitterballen page)
- Remove the member dropdown from the climb form — climbs are always logged for the current user.
- If the current user has no linked member, show a message instead of the form.
- Delete buttons on recent climbs only appear for your own climbs.

### Payments (no change to permissions)
- Anyone in the group can still record a payment and choose who paid.
- Anyone can delete a session.

## Done when
- Users can only log climbs as themselves
- Users can only delete their own climbs
- Unlinked members (no account) still appear in payment rotation and driving
- The climb form no longer has a member dropdown
- Adding unlinked members to a group is possible for payment/driving
