require("dotenv").config();
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === "false" ? false : (isProduction ? { rejectUnauthorized: false } : false),
});

async function initDatabase() {
    // Migration: drop unused users table from old ticket 16
    await pool.query(`DROP TABLE IF EXISTS users`);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
`);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS members (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            in_carpool BOOLEAN NOT NULL DEFAULT false,
            drive_order INTEGER,
            is_current_driver BOOLEAN NOT NULL DEFAULT false,
            pay_group INTEGER,
            pay_balance INTEGER NOT NULL DEFAULT 0
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS sessions (
            id SERIAL PRIMARY KEY,
            session_date DATE NOT NULL DEFAULT CURRENT_DATE,
            driver_id INTEGER REFERENCES members(id),
            payer_id INTEGER NOT NULL REFERENCES members(id),
            pay_group INTEGER NOT NULL
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS session_attendance (
            id SERIAL PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES sessions(id),
            member_id INTEGER NOT NULL REFERENCES members(id)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS climbs (
            id SERIAL PRIMARY KEY,
            member_id INTEGER NOT NULL REFERENCES members(id),
            grade VARCHAR(10) NOT NULL,
            grade_value INTEGER NOT NULL,
            climb_date DATE NOT NULL DEFAULT CURRENT_DATE
        )
    `);

    // --- Migration: replace pay_group with boolean flags, keep driving rotation ---

    // Add new columns (safe on fresh DBs — IF NOT EXISTS)
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS carpool BOOLEAN NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS beer BOOLEAN NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS bitterballen BOOLEAN NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS beer_balance INTEGER NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS drive_skipped BOOLEAN NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS drive_order INTEGER`);
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS is_current_driver BOOLEAN NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE session_attendance ADD COLUMN IF NOT EXISTS beer_count INTEGER NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE members DROP COLUMN IF EXISTS drive_balance`);
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS bitterballen_balance INTEGER NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS bitterballen_payer_id INTEGER REFERENCES members(id)`);

    // Make payer_id nullable (sessions can be driving-only)
    await pool.query(`ALTER TABLE sessions ALTER COLUMN payer_id DROP NOT NULL`);

    // Migrate data from old columns if they still exist
    const colCheck = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'members' AND column_name = 'pay_group'
    `);

    if (colCheck.rows.length > 0) {
        await pool.query(`UPDATE members SET carpool = in_carpool WHERE carpool = false AND in_carpool = true`);
        await pool.query(`UPDATE members SET beer = true WHERE pay_group IS NOT NULL`);
        await pool.query(`UPDATE members SET bitterballen = true`);
        await pool.query(`UPDATE members SET beer_balance = pay_balance WHERE beer_balance = 0 AND pay_balance != 0`);

        // Drop old columns (keep drive_order and is_current_driver for rotation)
        await pool.query(`ALTER TABLE members DROP COLUMN IF EXISTS in_carpool`);
        await pool.query(`ALTER TABLE members DROP COLUMN IF EXISTS pay_group`);
        await pool.query(`ALTER TABLE members DROP COLUMN IF EXISTS pay_balance`);
        await pool.query(`ALTER TABLE sessions DROP COLUMN IF EXISTS pay_group`);
    }

    // --- Migration: add group_id to data tables and seed default group ---

    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(id)`);
    await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(id)`);
    await pool.query(`ALTER TABLE climbs ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(id)`);

    // Create default group if it doesn't exist, then backfill
    const defaultGroup = await pool.query(`SELECT id FROM groups WHERE name = 'Witte 6Bami'`);
    if (defaultGroup.rows.length === 0) {
        const hash = await bcrypt.hash("BaanKwijt", 10);
        await pool.query(
            `INSERT INTO groups (name, email, password_hash) VALUES ('Witte 6Bami', 'admin@whosturn.app', $1)`,
            [hash]
        );
    }

    // Backfill: assign any rows without a group to the default group
    const group = await pool.query(`SELECT id FROM groups WHERE name = 'Witte 6Bami'`);
    if (group.rows.length > 0) {
        const groupId = group.rows[0].id;
        await pool.query(`UPDATE members SET group_id = $1 WHERE group_id IS NULL`, [groupId]);
        await pool.query(`UPDATE sessions SET group_id = $1 WHERE group_id IS NULL`, [groupId]);
        await pool.query(`UPDATE climbs SET group_id = $1 WHERE group_id IS NULL`, [groupId]);
    }

    console.log("Database initialized — tables ready");
}

module.exports = { pool, initDatabase };