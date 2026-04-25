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