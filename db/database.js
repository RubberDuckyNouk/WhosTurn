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
            is_current_driver BOOLEAN NOT NULL DEFAULT false
        )
    `);
    console.log("Database initialized — members table ready");
}

module.exports = { pool, initDatabase };