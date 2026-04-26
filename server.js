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

// Climbing grade order (French bouldering scale, no + grades)
const GRADES = [
    "3a", "3b", "3c",
    "4a", "4b", "4c",
    "5a", "5b", "5c",
    "6a", "6b", "6c",
    "7a", "7b", "7c",
    "8a", "8b"
];

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
            "SELECT * FROM members WHERE pay_group IS NOT NULL ORDER BY pay_group, pay_balance ASC, name"
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
    const { pay_group, payer_id, present_ids, session_date } = req.body;

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
            "INSERT INTO sessions (session_date, driver_id, payer_id, pay_group) VALUES ($1, $2, $3, $4) RETURNING id",
            [session_date || new Date(), currentDriver ? currentDriver.id : null, payer_id, pay_group]
        );
        const sessionId = sessionResult.rows[0].id;

        // Record attendance
        for (const memberId of present_ids) {
            await pool.query(
                "INSERT INTO session_attendance (session_id, member_id) VALUES ($1, $2)",
                [sessionId, memberId]
            );
        }

        // Update balances: payer gets +N (one per person paid for), others get -1
        const otherPresent = present_ids.filter(id => id !== payer_id);
        await pool.query(
            "UPDATE members SET pay_balance = pay_balance + $1 WHERE id = $2",
            [otherPresent.length, payer_id]
        );
        if (otherPresent.length > 0) {
            await pool.query(
                `UPDATE members SET pay_balance = pay_balance - 1
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

// Get session history
app.get("/api/sessions", async (req, res) => {
    try {
        const filter = req.query.filter || "week";

        let dateCondition;
        let params = [];

        if (filter === "week") {
            dateCondition = "s.session_date >= date_trunc('week', CURRENT_DATE)";
        } else if (filter === "month") {
            dateCondition = "s.session_date >= date_trunc('month', CURRENT_DATE)";
        } else {
            // Expect format "2026-04" for a specific month
            dateCondition = "to_char(s.session_date, 'YYYY-MM') = $1";
            params = [filter];
        }

        const result = await pool.query(
            `SELECT s.id, s.session_date, s.pay_group,
                    p.name AS payer_name, d.name AS driver_name
             FROM sessions s
             JOIN members p ON s.payer_id = p.id
             LEFT JOIN members d ON s.driver_id = d.id
             WHERE ${dateCondition}
             ORDER BY s.session_date DESC, s.id DESC`,
            params
        );

        // Get attendance for each session
        const sessions = [];
        for (const row of result.rows) {
            const attendance = await pool.query(
                `SELECT m.name FROM session_attendance sa
                 JOIN members m ON sa.member_id = m.id
                 WHERE sa.session_id = $1
                 ORDER BY m.name`,
                [row.id]
            );
            sessions.push({
                ...row,
                present: attendance.rows.map(a => a.name)
            });
        }

        res.json(sessions);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch session history" });
    }
});

// Delete a session and reverse balance changes
app.delete("/api/sessions/:id", async (req, res) => {
    const sessionId = parseInt(req.params.id);

    try {
        // Get the session details
        const session = await pool.query(
            "SELECT * FROM sessions WHERE id = $1",
            [sessionId]
        );

        if (session.rows.length === 0) {
            return res.status(404).json({ error: "Session not found" });
        }

        const { payer_id } = session.rows[0];

        // Get who was present
        const attendance = await pool.query(
            "SELECT member_id FROM session_attendance WHERE session_id = $1",
            [sessionId]
        );
        const presentIds = attendance.rows.map(r => r.member_id);
        const otherPresent = presentIds.filter(id => id !== payer_id);

        // Reverse balance changes: payer loses the points they gained
        await pool.query(
            "UPDATE members SET pay_balance = pay_balance - $1 WHERE id = $2",
            [otherPresent.length, payer_id]
        );

        // Others gain back their -1
        if (otherPresent.length > 0) {
            await pool.query(
                "UPDATE members SET pay_balance = pay_balance + 1 WHERE id = ANY($1)",
                [otherPresent]
            );
        }

        // Delete attendance records, then the session
        await pool.query(
            "DELETE FROM session_attendance WHERE session_id = $1",
            [sessionId]
        );
        await pool.query(
            "DELETE FROM sessions WHERE id = $1",
            [sessionId]
        );

        res.json({ message: "Session deleted and balances reversed" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete session" });
    }
});

// Log a climb
app.post("/api/climbs", async (req, res) => {
    const { member_id, grade, climb_date } = req.body;

    const gradeValue = GRADES.indexOf(grade);
    if (!member_id || gradeValue === -1) {
        return res.status(400).json({ error: "Invalid member or grade" });
    }

    try {
        await pool.query(
            "INSERT INTO climbs (member_id, grade, grade_value, climb_date) VALUES ($1, $2, $3, $4)",
            [member_id, grade, gradeValue, climb_date || new Date()]
        );
        res.status(201).json({ message: "Climb logged" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to log climb" });
    }
});

// Get current session climbs and PRs
app.get("/api/climbs/current", async (req, res) => {
    try {
        // Calculate last Thursday (or today if it's Thursday)
        const now = new Date();
        const day = now.getDay(); // 0=Sun, 4=Thu
        const daysSinceThursday = (day >= 4) ? (day - 4) : (day + 3);
        const lastThursday = new Date(now);
        lastThursday.setDate(now.getDate() - daysSinceThursday);
        lastThursday.setHours(0, 0, 0, 0);

        // Get all members
        const membersResult = await pool.query("SELECT id, name FROM members ORDER BY name");
        const members = membersResult.rows;

        // Get PRs for each member (all-time highest grade BEFORE this session)
        // and current session climbs
        const data = [];
        for (const member of members) {
            // All-time PR (before this session)
            const prBefore = await pool.query(
                `SELECT grade, grade_value FROM climbs
                 WHERE member_id = $1 AND climb_date < $2
                 ORDER BY grade_value DESC LIMIT 1`,
                [member.id, lastThursday]
            );

            // Overall PR (including this session)
            const prAll = await pool.query(
                `SELECT grade, grade_value FROM climbs
                 WHERE member_id = $1
                 ORDER BY grade_value DESC LIMIT 1`,
                [member.id]
            );

            // Current session climbs
            const sessionClimbs = await pool.query(
                `SELECT grade, grade_value FROM climbs
                 WHERE member_id = $1 AND climb_date >= $2
                 ORDER BY grade_value DESC`,
                [member.id, lastThursday]
            );

            const prBeforeValue = prBefore.rows[0]?.grade_value ?? -1;
            const sessionHighValue = sessionClimbs.rows[0]?.grade_value ?? -1;
            const isNewPr = sessionHighValue > prBeforeValue && sessionClimbs.rows.length > 0;
            const climbedAtPr = sessionHighValue >= prBeforeValue && prBeforeValue >= 0 && sessionClimbs.rows.length > 0;

            // Calculate points for this member (fractional, 1/N = full share)
            // New PR / at PR = full share, one below = 1/2, two below = 1/5, lower = 1/10
            const share = 1 / members.length;
            let memberPoints = 0;
            for (const climb of sessionClimbs.rows) {
                if (climb.grade_value > prBeforeValue) {
                    memberPoints += share * 1.5; // new PR
                } else if (climb.grade_value === prBeforeValue) {
                    memberPoints += share; // at PR
                } else if (climb.grade_value === prBeforeValue - 1) {
                    memberPoints += share / 2; // one below
                } else if (climb.grade_value === prBeforeValue - 2) {
                    memberPoints += share / 5; // two below
                } else if (prBeforeValue >= 0) {
                    memberPoints += share / 10; // anything lower
                }
            }

            data.push({
                id: member.id,
                name: member.name,
                pr: prAll.rows[0]?.grade || null,
                session_climbs: sessionClimbs.rows.length,
                session_high: sessionClimbs.rows[0]?.grade || null,
                is_new_pr: isNewPr,
                climbed_at_pr: climbedAtPr,
                points: memberPoints
            });
        }

        // Bitterballen index = total points across all members (no cap)
        // Target is 1.0 (each member's full share = 1/N, all members = 1.0)
        let totalPoints = 0;
        for (const m of data) {
            totalPoints += m.points;
        }

        res.json({ members: data, bitterballen_index: totalPoints, target: 1.0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch climb data" });
    }
});

// Get available grades
app.get("/api/grades", (req, res) => {
    res.json(GRADES);
});

app.get("/bitterballen", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "bitterballen.html"));
});