require("dotenv").config();
const { Pool } = require("pg");

const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
});

async function initDatabase() {
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

    console.log("Database initialized — tables ready");
}

module.exports = { pool, initDatabase };