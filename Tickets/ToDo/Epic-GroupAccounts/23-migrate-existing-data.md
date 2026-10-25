# 23 - Migrate Existing Data

## Description
Add `group_id` columns to the data tables and migrate all existing data into a default group. This prepares the database for multi-group support without breaking anything.

## Dependencies
Ticket 21 (Groups Table & Auth API)

## Tasks

### Schema changes
- Add `group_id` column (references `groups`, nullable initially) to:
  - `members`
  - `sessions`
  - `climbs`

### Migration logic (runs on server startup, in `initDatabase()`)
- Check if a group named "Default" (or similar) exists; if not, create it with a placeholder email and a known password
- Backfill: set `group_id` on all existing rows that have `group_id = NULL` to the default group's id
- After backfill, alter columns to `NOT NULL` (or leave nullable if safer — decide during implementation)

### No query changes yet
- Existing API queries continue to work as before (they don't filter by group_id yet — that's ticket 24)

## Done when
- `members`, `sessions`, and `climbs` tables have a `group_id` column
- All existing rows are assigned to the default group
- Server starts cleanly with the migration
- Existing functionality is unaffected
