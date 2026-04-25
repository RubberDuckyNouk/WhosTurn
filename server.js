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

// Get payment rotation (per group)
app.get("/api/payment", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM members WHERE pay_group IS NOT NULL ORDER BY pay_group, pay_order"
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
        res.status(500).json({ error: "Failed to fetch payment rotation" });
    }
});

// Record a session
app.post("/api/sessions", async (req, res) => {
    const { pay_group } = req.body;

    try {
        // Get current driver (if group 1, which has the carpool)
        const driverResult = await pool.query(
            "SELECT * FROM members WHERE is_current_driver = true"
        );
        const currentDriver = driverResult.rows[0] || null;

        // Get current payer for this group
        const payerResult = await pool.query(
            "SELECT * FROM members WHERE pay_group = $1 AND is_current_payer = true",
            [pay_group]
        );
        const currentPayer = payerResult.rows[0];

        if (!currentPayer) {
            return res.status(400).json({ error: "No current payer set for this group" });
        }

        // Record the session
        await pool.query(
            "INSERT INTO sessions (driver_id, payer_id, pay_group) VALUES ($1, $2, $3)",
            [currentDriver ? currentDriver.id : null, currentPayer.id, pay_group]
        );

        // Advance driving rotation (only when group 1 records, since they have the carpool)
        if (pay_group === 1 && currentDriver) {
            // Remove current driver flag
            await pool.query(
                "UPDATE members SET is_current_driver = false WHERE is_current_driver = true"
            );

            // Find the next driver
            const nextDriver = await pool.query(
                `SELECT * FROM members
                 WHERE in_carpool = true AND drive_order > $1
                 ORDER BY drive_order LIMIT 1`,
                [currentDriver.drive_order]
            );

            if (nextDriver.rows.length > 0) {
                // Set next person as current driver
                await pool.query(
                    "UPDATE members SET is_current_driver = true WHERE id = $1",
                    [nextDriver.rows[0].id]
                );
            } else {
                // Wrap around to the first driver
                await pool.query(
                    `UPDATE members SET is_current_driver = true
                     WHERE in_carpool = true
                     ORDER BY drive_order LIMIT 1`
                );
            }
        }

        // Advance payment rotation for this group
        await pool.query(
            "UPDATE members SET is_current_payer = false WHERE pay_group = $1 AND is_current_payer = true",
            [pay_group]
        );

        const nextPayer = await pool.query(
            `SELECT * FROM members
             WHERE pay_group = $1 AND pay_order > $2
             ORDER BY pay_order LIMIT 1`,
            [pay_group, currentPayer.pay_order]
        );

        if (nextPayer.rows.length > 0) {
            await pool.query(
                "UPDATE members SET is_current_payer = true WHERE id = $1",
                [nextPayer.rows[0].id]
            );
        } else {
            // Wrap around to the first payer in this group
            await pool.query(
                `UPDATE members SET is_current_payer = true
                 WHERE id = (
                     SELECT id FROM members
                     WHERE pay_group = $1
                     ORDER BY pay_order LIMIT 1
                 )`,
                [pay_group]
            );
        }

        res.status(201).json({ message: "Session recorded" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to record session" });
    }
});