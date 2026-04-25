# 04 - Set Up PostgreSQL Database

## Description
Create a database connection module using pg (node-postgres) and define the initial schema with a members table. PostgreSQL runs as a separate server, so a connection string is used to connect.

## Tasks
- Install PostgreSQL locally and create a database called `whosturn`
- Create `db/database.js` that connects to PostgreSQL using a connection string
- Store the connection string in a `.env` file (not in code)
- Install `dotenv` to load environment variables
- Define a `members` table with columns: `id`, `name`, `in_carpool` (boolean)
- Run the schema creation on startup (CREATE TABLE IF NOT EXISTS)
- Add `.env` to `.gitignore`

## Done when
- A database connection module exists and is reusable
- The connection string is stored in `.env`, not hardcoded
- The `members` table is created automatically on first run
- `.env` is excluded from git

---

## Implementation Steps

### Step 1: Install PostgreSQL

If you don't have PostgreSQL installed yet:

1. Download it from https://www.postgresql.org/download/windows/
2. Run the installer — remember the password you set for the `postgres` user
3. Keep the default port (5432)
4. After installation, open **pgAdmin** (it comes with PostgreSQL) or use the **SQL Shell (psql)** from the Start menu

### Step 2: Create the database

Open the SQL Shell (psql). It will ask you a few questions — press Enter to accept the defaults for everything except the password (use the one you set during installation):

```
Server [localhost]:
Database [postgres]:
Port [5432]:
Username [postgres]:
Password: ********
```

Then run:

```sql
CREATE DATABASE whosturn;
```

Type `\q` to exit.

**What's happening here:**
- PostgreSQL is a database server that runs in the background on your machine
- `psql` is a command-line tool to talk to it
- `CREATE DATABASE whosturn` — creates a new empty database called `whosturn` that our app will use
- Unlike SQLite, PostgreSQL can hold many databases at once — each app gets its own

### Step 3: Create the `.env` file

Create a file called `.env` in the project root with this content:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD_HERE@localhost:5432/whosturn
```

Replace `YOUR_PASSWORD_HERE` with the password you set during PostgreSQL installation.

**What's happening here:**
- This is a **connection string** — it tells our app how to connect to the database
- The format is: `postgresql://username:password@host:port/database`
- We store this in `.env` instead of in the code because:
  - It contains a password — you don't want that in git
  - It's different per environment (your machine vs. the production server)
- The `.env` file is already in `.gitignore` so it won't be committed

### Step 4: Create `db/database.js`

Create a new file `db/database.js` with this content:

```js
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS members (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            in_carpool BOOLEAN NOT NULL DEFAULT false
        )
    `);
    console.log("Database initialized — members table ready");
}

module.exports = { pool, initDatabase };
```

**What's happening here:**
- `require("dotenv").config()` — loads the variables from `.env` into `process.env` so we can use them in code
- `Pool` — a connection pool from the `pg` library. Instead of opening a new connection for every query, a pool keeps a set of connections ready to reuse. This is faster and more efficient
- `process.env.DATABASE_URL` — reads the connection string from the `.env` file
- `initDatabase()` — runs a SQL query to create the `members` table if it doesn't exist yet
- `SERIAL PRIMARY KEY` — an auto-incrementing ID. PostgreSQL assigns the next number automatically when you insert a row
- `VARCHAR(100)` — a text field with a max length of 100 characters
- `BOOLEAN NOT NULL DEFAULT false` — a true/false field that can't be empty and defaults to false
- `module.exports = { pool, initDatabase }` — exports both so other files can use the pool to run queries and call initDatabase on startup

### Step 5: Connect the database to the server

Open `server.js` and add the database import near the top (after the other requires):

```js
const { pool, initDatabase } = require("./db/database");
```

Then change the `app.listen` block at the bottom to initialize the database before starting the server:

```js
// Start the server
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
});
```

**What's happening here:**
- We import `initDatabase` from our database module
- `initDatabase()` returns a **Promise** (because it's `async`) — the `.then()` waits for the database to be ready before starting the server
- This way the table is guaranteed to exist before any requests come in

### Step 6: Verify

1. Make sure PostgreSQL is running (it should start automatically after installation)
2. Run `npm run dev`
3. You should see two messages in the terminal:
   ```
   Database initialized — members table ready
   Server running on http://localhost:3000
   ```
4. If you see a connection error, double-check your password in `.env` and make sure PostgreSQL is running

To confirm the table was created, open psql again and run:

```
\c whosturn
\dt
```

You should see the `members` table listed.

**What's happening here:**
- `\c whosturn` — connects to the whosturn database
- `\dt` — lists all tables in the current database
