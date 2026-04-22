# 04 - Set Up SQLite Database

## Description
Create a database connection module using better-sqlite3 and define the initial schema with a members table.

## Tasks
- Create `db/database.js` that opens (or creates) a SQLite database file
- Define a `members` table with columns: `id`, `name`, `in_carpool` (boolean)
- Run the schema creation on startup (create table if not exists)
- Verify the database file gets created in `db/`
- Add the `.db` file to `.gitignore`

## Done when
- A database connection module exists and is reusable
- The `members` table is created automatically on first run
- The database file is excluded from git
