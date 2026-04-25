# 15 - Edit Today's Session

## Description
When recording a session, check if one was already recorded today for that group. If so, show a popup giving the user the choice to **update the existing session** or **add a new one**. This prevents accidental duplicates while still allowing multiple sessions per day if intended.

Editing older sessions (last week, etc.) is handled separately in ticket 10 (Session History).

## How it works
1. User clicks "Record Session"
2. Backend checks if a session exists today for that group
3. If **no session today** — proceed as normal (attendance modal, then record)
4. If **session exists today** — show a popup first:
   - "A session was already recorded today for this group."
   - **Update existing** — opens attendance modal, replaces the existing session (reverses old balances, applies new ones)
   - **Add new session** — opens attendance modal, creates a new session as normal
   - **Cancel** — closes the popup

## Tasks
- Add an API endpoint or query to check for an existing session today per group
- Show a choice popup when a same-day session is detected
- "Update existing" reverses old balance changes, updates session/attendance records, applies new balances
- "Add new session" creates a fresh session as normal
- Show a distinct success message: "Session updated" vs "Session recorded"

## Done when
- Recording when no session exists today works as before
- Recording when a session exists today shows the choice popup
- "Update existing" correctly reverses old balances and applies new ones
- "Add new session" creates a separate session without affecting the old one
- Success messages clearly indicate what happened
