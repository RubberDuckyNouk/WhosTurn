# 15 - Edit Today's Session

## Description
If a session has already been recorded today for a group, recording again should update the existing session instead of creating a new one. This prevents accidental double entries and lets users correct mistakes. The UI should clearly indicate when an existing session is being updated rather than a new one being created.

## Tasks
- Check for an existing session for the same `pay_group` on `CURRENT_DATE` before inserting
- If one exists, reverse the old balance changes, update the session record, and apply new balances
- Update the attendance records to match the new present members
- Show a distinct message in the UI when updating vs creating (e.g. "Session updated" vs "Session recorded")
- Indicate on the Record button or modal that a session already exists today

## Done when
- Recording twice on the same day for the same group updates the existing session
- Balances are correct after an update (old values reversed, new values applied)
- The user can clearly see that they are updating an existing session, not creating a new one
