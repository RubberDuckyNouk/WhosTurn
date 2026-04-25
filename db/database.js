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
            in_carpool BOOLEAN NOT NULL DEFAULT false,
            drive_order INTEGER,
            is_current_driver BOOLEAN NOT NULL DEFAULT false,
            pay_group INTEGER,
            pay_order INTEGER,
            is_current_payer BOOLEAN NOT NULL DEFAULT false
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

    console.log("Database initialized — tables ready");
}

module.exports = { pool, initDatabase };