const express = require("express");
const path = require("path");
const { pool, initDatabase } = require("./db/database");

const app = express();
const PORT = 3000;

// Live reload (development only)
const livereload = require("livereload");

const liveReloadServer = livereload.createServer();
liveReloadServer.watch([
    path.join(__dirname, "public"),
    path.join(__dirname, "views")
]);

liveReloadServer.server.once("connection", () => {
    setTimeout(() => {
        liveReloadServer.refresh("/");
    }, 100);
});

// Enable JSON parsing
app.use(express.json());

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, "public")));


// get html file
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "index.html"));
});

// Start the server
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
});

// Get all members
app.get("/api/members", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM members ORDER BY name");
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch members" });
    }
});

// Get driving rotation
app.get("/api/driving", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM members WHERE in_carpool = true ORDER BY drive_order"
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch driving rotation" });
    }
});

// Get payment balances (per group)
app.get("/api/payment", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM members WHERE pay_group IS NOT NULL ORDER BY pay_group, pay_balance DESC, name"
        );

        // Group members by pay_group
        const groups = {};
        result.rows.forEach(member => {
            if (!groups[member.pay_group]) {
                groups[member.pay_group] = [];
            }
            groups[member.pay_group].push(member);
        });

        res.json(groups);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch payment data" });
    }
});

// Record a session
app.post("/api/sessions", async (req, res) => {
    const { pay_group, payer_id, present_ids } = req.body;

    if (!pay_group || !payer_id || !present_ids || present_ids.length === 0) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        // Record the session
        const driverResult = await pool.query(
            "SELECT * FROM members WHERE is_current_driver = true"
        );
        const currentDriver = driverResult.rows[0] || null;

        const sessionResult = await pool.query(
            "INSERT INTO sessions (driver_id, payer_id, pay_group) VALUES ($1, $2, $3) RETURNING id",
            [currentDriver ? currentDriver.id : null, payer_id, pay_group]
        );
        const sessionId = sessionResult.rows[0].id;

        // Record attendance
        for (const memberId of present_ids) {
            await pool.query(
                "INSERT INTO session_attendance (session_id, member_id) VALUES ($1, $2)",
                [sessionId, memberId]
            );
        }

        // Update balances: payer gets -1, all other present members get +1
        await pool.query(
            "UPDATE members SET pay_balance = pay_balance - 1 WHERE id = $1",
            [payer_id]
        );

        const otherPresent = present_ids.filter(id => id !== payer_id);
        if (otherPresent.length > 0) {
            await pool.query(
                `UPDATE members SET pay_balance = pay_balance + 1
                 WHERE id = ANY($1)`,
                [otherPresent]
            );
        }

        // Advance driving rotation (only when group 1 records)
        if (pay_group === 1 && currentDriver) {
            await pool.query(
                "UPDATE members SET is_current_driver = false WHERE is_current_driver = true"
            );

            const nextDriver = await pool.query(
                `SELECT * FROM members
                 WHERE in_carpool = true AND drive_order > $1
                 ORDER BY drive_order LIMIT 1`,
                [currentDriver.drive_order]
            );

            if (nextDriver.rows.length > 0) {
                await pool.query(
                    "UPDATE members SET is_current_driver = true WHERE id = $1",
                    [nextDriver.rows[0].id]
                );
            } else {
                await pool.query(
                    `UPDATE members SET is_current_driver = true
                     WHERE id = (
                         SELECT id FROM members
                         WHERE in_carpool = true
                         ORDER BY drive_order LIMIT 1
                     )`
                );
            }
        }

        res.status(201).json({ message: "Session recorded" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to record session" });
    }
});

