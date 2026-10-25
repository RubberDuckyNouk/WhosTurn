const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcrypt");

const express = require("express");
const path = require("path");
const { pool, initDatabase } = require("./db/database");

const app = express();
const PORT = process.env.PORT || 3000;


// Live reload (development only)
if (process.env.NODE_ENV !== "production") {
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
}

// Climbing grade order (French bouldering scale, with + grades)
const GRADES = [
    "3a", "3a+", "3b", "3b+", "3c", "3c+",
    "4a", "4a+", "4b", "4b+", "4c", "4c+",
    "5a", "5a+", "5b", "5b+", "5c", "5c+",
    "6a", "6a+", "6b", "6b+", "6c", "6c+",
    "7a", "7a+", "7b", "7b+", "7c", "7c+",
    "8a", "8a+", "8b", "8b+"
];

// Trust first proxy (needed for secure cookies behind reverse proxy)
if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

// Enable JSON parsing
app.use(express.json());

// Session middleware (stored in PostgreSQL, 30-day cookie)
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: "user_sessions",
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
    }
}));

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, "public")));

// --- Auth API ---

const SALT_ROUNDS = 10;

// Create a new group
app.post("/api/auth/signup", async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    try {
        const existing = await pool.query("SELECT id FROM groups WHERE name = $1", [name]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: "Group name already taken" });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const result = await pool.query(
            "INSERT INTO groups (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email",
            [name.trim(), email.trim(), passwordHash]
        );

        const group = result.rows[0];
        req.session.groupId = group.id;

        res.status(201).json({ id: group.id, name: group.name, email: group.email });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create group" });
    }
});

// Log in to a group
app.post("/api/auth/login", async (req, res) => {
    const { name, password } = req.body;

    if (!name || !password) {
        return res.status(400).json({ error: "Group name and password are required" });
    }

    try {
        const result = await pool.query("SELECT * FROM groups WHERE name = $1", [name]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Invalid group name or password" });
        }

        const group = result.rows[0];
        const match = await bcrypt.compare(password, group.password_hash);
        if (!match) {
            return res.status(401).json({ error: "Invalid group name or password" });
        }

        req.session.groupId = group.id;

        res.json({ id: group.id, name: group.name, email: group.email });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Login failed" });
    }
});

// Log out
app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: "Logout failed" });
        }
        res.clearCookie("connect.sid");
        res.json({ message: "Logged out" });
    });
});

// Get current group
app.get("/api/auth/me", async (req, res) => {
    if (!req.session.groupId) {
        return res.status(401).json({ error: "Not logged in" });
    }

    try {
        const result = await pool.query(
            "SELECT id, name, email FROM groups WHERE id = $1",
            [req.session.groupId]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Group not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch group" });
    }
});

// Auth gate — require login for all routes except public paths
app.use((req, res, next) => {
    // Skip auth for public paths
    const publicPaths = ["/login", "/signup", "/api/auth/login", "/api/auth/signup", "/api/grades"];
    if (publicPaths.includes(req.path)) return next();

    // Skip if already logged in
    if (req.session.groupId) return next();

    // API routes return 401 JSON
    if (req.path.startsWith("/api/")) {
        return res.status(401).json({ error: "Login required" });
    }

    // Page routes redirect to login
    res.redirect("/login");
});

// Auth pages
app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.get("/signup", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "signup.html"));
});

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

// Get all members (optional filters: ?carpool=true, ?beer=true, ?bitterballen=true)
app.get("/api/members", async (req, res) => {
    const groupId = req.session.groupId;
    try {
        let query = "SELECT * FROM members";
        const conditions = ["group_id = $1"];
        if (req.query.carpool === "true") conditions.push("carpool = true");
        if (req.query.beer === "true") conditions.push("beer = true");
        if (req.query.bitterballen === "true") conditions.push("bitterballen = true");
        query += " WHERE " + conditions.join(" AND ");
        query += " ORDER BY name";
        const result = await pool.query(query, [groupId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch members" });
    }
});

// Get carpool members with rotation info
app.get("/api/driving", async (req, res) => {
    const groupId = req.session.groupId;
    try {
        const result = await pool.query(
            "SELECT * FROM members WHERE carpool = true AND group_id = $1 ORDER BY drive_order",
            [groupId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch driving data" });
    }
});

// Get beer members sorted by beer balance (lowest = should pay next)
app.get("/api/payment", async (req, res) => {
    const groupId = req.session.groupId;
    try {
        const result = await pool.query(
            "SELECT * FROM members WHERE beer = true AND group_id = $1 ORDER BY beer_balance ASC, name",
            [groupId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch payment data" });
    }
});

// Record a session
app.post("/api/sessions", async (req, res) => {
    const groupId = req.session.groupId;
    const { session_date, driver_id, payer_id, beer_counts, present_ids, bitterballen_payer_id } = req.body;

    if (!driver_id && !payer_id && !bitterballen_payer_id) {
        return res.status(400).json({ error: "Must record driving, beer payment, or bitterballen payment" });
    }
    if (!present_ids || present_ids.length === 0) {
        return res.status(400).json({ error: "At least one person must be present" });
    }

    try {
        // Insert session
        const sessionResult = await pool.query(
            "INSERT INTO sessions (session_date, driver_id, payer_id, bitterballen_payer_id, group_id) VALUES ($1, $2, $3, $4, $5) RETURNING id",
            [session_date || new Date(), driver_id || null, payer_id || null, bitterballen_payer_id || null, groupId]
        );
        const sessionId = sessionResult.rows[0].id;

        // Record attendance with beer counts
        for (const memberId of present_ids) {
            const beerCount = (beer_counts && beer_counts[memberId]) ? beer_counts[memberId] : 0;
            await pool.query(
                "INSERT INTO session_attendance (session_id, member_id, beer_count) VALUES ($1, $2, $3)",
                [sessionId, memberId, beerCount]
            );
        }

        // Update driving rotation
        if (driver_id) {
            // Find who was supposed to drive: skipped member first, otherwise current driver
            const skippedResult = await pool.query(
                "SELECT id FROM members WHERE carpool = true AND drive_skipped = true AND group_id = $1 LIMIT 1",
                [groupId]
            );
            const currentResult = await pool.query(
                "SELECT id, drive_order FROM members WHERE is_current_driver = true AND group_id = $1 LIMIT 1",
                [groupId]
            );

            const suggestedId = skippedResult.rows.length > 0
                ? skippedResult.rows[0].id
                : (currentResult.rows[0]?.id || null);

            const suggestedWasCurrent = currentResult.rows.length > 0
                && currentResult.rows[0].id === suggestedId;

            if (driver_id !== suggestedId && suggestedId) {
                // Someone else drove — mark the suggested driver as skipped (capped at 1)
                await pool.query(
                    "UPDATE members SET drive_skipped = true WHERE id = $1",
                    [suggestedId]
                );
            }

            // If the actual driver was skipped, clear it
            await pool.query(
                "UPDATE members SET drive_skipped = false WHERE id = $1",
                [driver_id]
            );

            // Advance rotation if the suggested driver was the current rotation driver
            if (suggestedWasCurrent) {
                await pool.query("UPDATE members SET is_current_driver = false WHERE is_current_driver = true AND group_id = $1", [groupId]);
                const nextDriver = await pool.query(
                    `SELECT id FROM members
                     WHERE carpool = true AND drive_order > $1 AND group_id = $2
                     ORDER BY drive_order LIMIT 1`,
                    [currentResult.rows[0].drive_order, groupId]
                );
                if (nextDriver.rows.length > 0) {
                    await pool.query("UPDATE members SET is_current_driver = true WHERE id = $1", [nextDriver.rows[0].id]);
                } else {
                    await pool.query(
                        `UPDATE members SET is_current_driver = true
                         WHERE id = (SELECT id FROM members WHERE carpool = true AND group_id = $1 ORDER BY drive_order LIMIT 1)`,
                        [groupId]
                    );
                }
            }
        }

        // Update beer balances (weighted by beer count)
        if (payer_id && beer_counts) {
            const totalOtherBeers = Object.entries(beer_counts)
                .filter(([id]) => parseInt(id) !== payer_id)
                .reduce((sum, [, count]) => sum + count, 0);

            if (totalOtherBeers > 0) {
                await pool.query(
                    "UPDATE members SET beer_balance = beer_balance + $1 WHERE id = $2",
                    [totalOtherBeers, payer_id]
                );
            }

            for (const [memberId, count] of Object.entries(beer_counts)) {
                if (parseInt(memberId) !== payer_id && count > 0) {
                    await pool.query(
                        "UPDATE members SET beer_balance = beer_balance - $1 WHERE id = $2",
                        [count, parseInt(memberId)]
                    );
                }
            }
        }

        // Update bitterballen balances (equal split among beer group)
        if (bitterballen_payer_id) {
            const beerMembers = await pool.query("SELECT id FROM members WHERE beer = true AND group_id = $1", [groupId]);
            const allIds = beerMembers.rows.map(r => r.id);
            const otherCount = allIds.filter(id => id !== bitterballen_payer_id).length;

            if (otherCount > 0) {
                await pool.query(
                    "UPDATE members SET bitterballen_balance = bitterballen_balance + $1 WHERE id = $2",
                    [otherCount, bitterballen_payer_id]
                );
                for (const id of allIds) {
                    if (id !== bitterballen_payer_id) {
                        await pool.query(
                            "UPDATE members SET bitterballen_balance = bitterballen_balance - 1 WHERE id = $1",
                            [id]
                        );
                    }
                }
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
    const groupId = req.session.groupId;
    try {
        const filter = req.query.filter || "week";

        let dateCondition;
        let params = [groupId];

        if (filter === "week") {
            dateCondition = "s.session_date >= date_trunc('week', CURRENT_DATE)";
        } else if (filter === "month") {
            dateCondition = "s.session_date >= date_trunc('month', CURRENT_DATE)";
        } else {
            // Expect format "2026-04" for a specific month
            dateCondition = "to_char(s.session_date, 'YYYY-MM') = $2";
            params.push(filter);
        }

        const result = await pool.query(
            `SELECT s.id, s.session_date,
                    p.name AS payer_name, d.name AS driver_name,
                    bp.name AS bitterballen_payer_name
             FROM sessions s
             LEFT JOIN members p ON s.payer_id = p.id
             LEFT JOIN members d ON s.driver_id = d.id
             LEFT JOIN members bp ON s.bitterballen_payer_id = bp.id
             WHERE s.group_id = $1 AND ${dateCondition}
             ORDER BY s.session_date DESC, s.id DESC`,
            params
        );

        // Get attendance for each session (includes beer counts)
        const sessions = [];
        for (const row of result.rows) {
            const attendance = await pool.query(
                `SELECT m.name, sa.beer_count FROM session_attendance sa
                 JOIN members m ON sa.member_id = m.id
                 WHERE sa.session_id = $1
                 ORDER BY m.name`,
                [row.id]
            );
            sessions.push({
                ...row,
                present: attendance.rows.map(a => a.name),
                beer_details: attendance.rows
                    .filter(a => a.beer_count > 0)
                    .map(a => `${a.name}(${a.beer_count})`)
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
    const groupId = req.session.groupId;
    const sessionId = parseInt(req.params.id);

    try {
        const session = await pool.query("SELECT * FROM sessions WHERE id = $1 AND group_id = $2", [sessionId, groupId]);
        if (session.rows.length === 0) {
            return res.status(404).json({ error: "Session not found" });
        }

        const { payer_id, driver_id, bitterballen_payer_id } = session.rows[0];

        // Get attendance with beer counts
        const attendance = await pool.query(
            "SELECT member_id, beer_count FROM session_attendance WHERE session_id = $1",
            [sessionId]
        );
        const attendees = attendance.rows;

        // Reverse beer balance changes
        if (payer_id) {
            const totalOtherBeers = attendees
                .filter(a => a.member_id !== payer_id)
                .reduce((sum, a) => sum + a.beer_count, 0);

            if (totalOtherBeers > 0) {
                await pool.query(
                    "UPDATE members SET beer_balance = beer_balance - $1 WHERE id = $2",
                    [totalOtherBeers, payer_id]
                );
            }

            for (const a of attendees) {
                if (a.member_id !== payer_id && a.beer_count > 0) {
                    await pool.query(
                        "UPDATE members SET beer_balance = beer_balance + $1 WHERE id = $2",
                        [a.beer_count, a.member_id]
                    );
                }
            }
        }

        // Reverse bitterballen balance changes
        if (bitterballen_payer_id) {
            const beerMembers = await pool.query("SELECT id FROM members WHERE beer = true AND group_id = $1", [groupId]);
            const allIds = beerMembers.rows.map(r => r.id);
            const otherCount = allIds.filter(id => id !== bitterballen_payer_id).length;

            if (otherCount > 0) {
                await pool.query(
                    "UPDATE members SET bitterballen_balance = bitterballen_balance - $1 WHERE id = $2",
                    [otherCount, bitterballen_payer_id]
                );
                for (const id of allIds) {
                    if (id !== bitterballen_payer_id) {
                        await pool.query(
                            "UPDATE members SET bitterballen_balance = bitterballen_balance + 1 WHERE id = $1",
                            [id]
                        );
                    }
                }
            }
        }

        // Note: driving rotation state is not reversed on delete

        // Delete attendance records, then the session
        await pool.query("DELETE FROM session_attendance WHERE session_id = $1", [sessionId]);
        await pool.query("DELETE FROM sessions WHERE id = $1", [sessionId]);

        res.json({ message: "Session deleted and balances reversed" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete session" });
    }
});

// Log a climb
app.post("/api/climbs", async (req, res) => {
    const groupId = req.session.groupId;
    const { member_id, grade, climb_date } = req.body;

    const gradeValue = GRADES.indexOf(grade);
    if (!member_id || gradeValue === -1) {
        return res.status(400).json({ error: "Invalid member or grade" });
    }

    try {
        await pool.query(
            "INSERT INTO climbs (member_id, grade, grade_value, climb_date, group_id) VALUES ($1, $2, $3, $4, $5)",
            [member_id, grade, gradeValue, climb_date || new Date(), groupId]
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
        // Calculate last Thursday (or today if it's Thursday) as a plain date string
        // to avoid timezone issues when comparing against DATE columns
        const now = new Date();
        const day = now.getDay(); // 0=Sun, 4=Thu
        const daysSinceThursday = (day >= 4) ? (day - 4) : (day + 3);
        const lastThursday = new Date(now);
        lastThursday.setDate(now.getDate() - daysSinceThursday);
        const lastThursdayStr = lastThursday.toISOString().split("T")[0];

        // Get bitterballen-participating members
        const membersResult = await pool.query("SELECT id, name FROM members WHERE bitterballen = true AND group_id = $1 ORDER BY name", [req.session.groupId]);
        const members = membersResult.rows;

        // Check which members were present at a beer session since last Thursday
        const beerAttendance = await pool.query(
            `SELECT DISTINCT sa.member_id
             FROM session_attendance sa
             JOIN sessions s ON sa.session_id = s.id
             WHERE s.payer_id IS NOT NULL
               AND s.session_date >= $1
               AND s.group_id = $2`,
            [lastThursdayStr, req.session.groupId]
        );
        const presentAtBeer = new Set(beerAttendance.rows.map(r => r.member_id));

        // Get PRs for each member (all-time highest grade BEFORE this session)
        // and current session climbs
        const data = [];
        for (const member of members) {
            // All-time PR (before this session)
            const prBefore = await pool.query(
                `SELECT grade, grade_value FROM climbs
                 WHERE member_id = $1 AND climb_date < $2::date
                 ORDER BY grade_value DESC LIMIT 1`,
                [member.id, lastThursdayStr]
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
                 WHERE member_id = $1 AND climb_date >= $2::date
                 ORDER BY grade_value DESC`,
                [member.id, lastThursdayStr]
            );

            const hasPrHistory = prBefore.rows.length > 0;
            const prBeforeValue = prBefore.rows[0]?.grade_value ?? -1;
            const sessionHighValue = sessionClimbs.rows[0]?.grade_value ?? -1;
            const isNewPr = hasPrHistory && sessionHighValue > prBeforeValue;
            const climbedAtPr = hasPrHistory && sessionHighValue >= prBeforeValue;

            // A member is "present" if they have climbs or were in a beer session
            const isPresent = sessionClimbs.rows.length > 0 || presentAtBeer.has(member.id);

            data.push({
                id: member.id,
                name: member.name,
                pr: prAll.rows[0]?.grade || null,
                session_climbs: sessionClimbs.rows.length,
                session_high: sessionClimbs.rows[0]?.grade || null,
                is_new_pr: isNewPr,
                climbed_at_pr: climbedAtPr,
                is_present: isPresent,
                pr_before_value: prBeforeValue,
                has_pr_history: hasPrHistory,
                climbs: sessionClimbs.rows
            });
        }

        // Only count present members for the share denominator
        const presentCount = data.filter(d => d.is_present).length;
        const share = presentCount > 0 ? 1 / presentCount : 0;

        // Calculate points per member (best climb only)
        const PR_BONUS_1 = 0.5;   // 1 member beats PR: +50% → 150%
        const PR_BONUS_2 = 1.5;   // 2+ members beat PR: +150% → 250%

        let totalPoints = 0;
        let prCount = 0;
        for (const m of data) {
            const sessionHigh = m.climbs.length > 0 ? m.climbs[0].grade_value : -1;
            let memberPoints = 0;
            if (m.climbs.length === 0) {
                memberPoints = 0;
            } else if (!m.has_pr_history) {
                memberPoints = share * 0.1; // no prior history, baseline only
            } else if (sessionHigh > m.pr_before_value) {
                memberPoints = share; // new PR (base share, bonus added separately)
                prCount++;
            } else if (sessionHigh === m.pr_before_value) {
                memberPoints = share; // at PR
            } else if (sessionHigh === m.pr_before_value - 1) {
                memberPoints = share * 0.2; // one below
            } else {
                memberPoints = share * 0.1; // 2+ below
            }
            m.points = memberPoints;
            totalPoints += memberPoints;
            // Clean up intermediate fields from response
            delete m.pr_before_value;
            delete m.has_pr_history;
            delete m.climbs;
        }

        // Add hardcoded PR bonus
        if (prCount >= 2) {
            totalPoints += PR_BONUS_2;
        } else if (prCount === 1) {
            totalPoints += PR_BONUS_1;
        }

        res.json({ members: data, bitterballen_index: totalPoints, target: 1.0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch climb data" });
    }
});

// Get last 10 logged climbs
app.get("/api/climbs/recent", async (req, res) => {
    const groupId = req.session.groupId;
    try {
        const result = await pool.query(
            `SELECT c.id, c.grade, c.climb_date, m.name AS member_name
             FROM climbs c
             JOIN members m ON c.member_id = m.id
             WHERE c.group_id = $1
             ORDER BY c.id DESC
             LIMIT 10`,
            [groupId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch recent climbs" });
    }
});

// Delete a climb
app.delete("/api/climbs/:id", async (req, res) => {
    const groupId = req.session.groupId;
    const climbId = parseInt(req.params.id);

    try {
        const result = await pool.query("DELETE FROM climbs WHERE id = $1 AND group_id = $2", [climbId, groupId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Climb not found" });
        }
        res.json({ message: "Climb deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete climb" });
    }
});

// Get available grades
app.get("/api/grades", (req, res) => {
    res.json(GRADES);
});

// Get per-member climb stats (last 12 months)
app.get("/api/climbs/stats", async (req, res) => {
    const groupId = req.session.groupId;
    const memberId = parseInt(req.query.member_id);
    if (!memberId) {
        return res.status(400).json({ error: "member_id is required" });
    }

    try {
        const result = await pool.query(
            `SELECT to_char(climb_date, 'YYYY-MM') AS month,
                    COUNT(*)::int AS route_count,
                    MAX(grade_value) AS max_grade_value
             FROM climbs
             WHERE member_id = $1 AND group_id = $2
               AND climb_date >= (CURRENT_DATE - INTERVAL '12 months')
             GROUP BY to_char(climb_date, 'YYYY-MM')
             ORDER BY month ASC`,
            [memberId, groupId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch climb stats" });
    }
});

// Get average of top 10 grades in the last 2 months
app.get("/api/climbs/top-average", async (req, res) => {
    const groupId = req.session.groupId;
    const memberId = parseInt(req.query.member_id);
    if (!memberId) {
        return res.status(400).json({ error: "member_id is required" });
    }

    try {
        const result = await pool.query(
            `SELECT AVG(grade_value) AS avg_grade_value
             FROM (
                 SELECT grade_value
                 FROM climbs
                 WHERE member_id = $1 AND group_id = $2
                   AND climb_date >= (CURRENT_DATE - INTERVAL '2 months')
                 ORDER BY grade_value DESC
                 LIMIT 10
             ) top10`,
            [memberId, groupId]
        );
        const avg = result.rows[0].avg_grade_value;
        res.json({ avg_grade_value: avg !== null ? parseFloat(avg) : null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch top average" });
    }
});

// Create a member
app.post("/api/members", async (req, res) => {
    const groupId = req.session.groupId;
    const { name, carpool, beer, bitterballen } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: "Name is required" });
    }

    try {
        let driveOrder = null;
        if (carpool) {
            const maxOrder = await pool.query("SELECT COALESCE(MAX(drive_order), 0) + 1 AS next FROM members WHERE carpool = true AND group_id = $1", [groupId]);
            driveOrder = maxOrder.rows[0].next;
        }

        const result = await pool.query(
            `INSERT INTO members (name, carpool, beer, bitterballen, drive_order, group_id)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [name.trim(), !!carpool, !!beer, !!bitterballen, driveOrder, groupId]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create member" });
    }
});

// Update a member
app.put("/api/members/:id", async (req, res) => {
    const groupId = req.session.groupId;
    const memberId = parseInt(req.params.id);
    const { name, carpool, beer, bitterballen } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: "Name is required" });
    }

    try {
        // If carpool is being enabled and member has no drive_order, assign one
        let driveOrderUpdate = "";
        let params = [name.trim(), !!carpool, !!beer, !!bitterballen, memberId, groupId];
        if (carpool) {
            const current = await pool.query("SELECT drive_order FROM members WHERE id = $1 AND group_id = $2", [memberId, groupId]);
            if (!current.rows[0]?.drive_order) {
                const maxOrder = await pool.query("SELECT COALESCE(MAX(drive_order), 0) + 1 AS next FROM members WHERE carpool = true AND group_id = $1", [groupId]);
                driveOrderUpdate = ", drive_order = $7";
                params.push(maxOrder.rows[0].next);
            }
        }

        const result = await pool.query(
            `UPDATE members SET name = $1, carpool = $2, beer = $3, bitterballen = $4${driveOrderUpdate}
             WHERE id = $5 AND group_id = $6 RETURNING *`,
            params
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Member not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update member" });
    }
});

// Delete a member
app.delete("/api/members/:id", async (req, res) => {
    const groupId = req.session.groupId;
    const memberId = parseInt(req.params.id);

    try {
        // Check for references in sessions or climbs
        const sessionRef = await pool.query(
            "SELECT COUNT(*) FROM session_attendance WHERE member_id = $1",
            [memberId]
        );
        const driverRef = await pool.query(
            "SELECT COUNT(*) FROM sessions WHERE driver_id = $1 OR payer_id = $1 OR bitterballen_payer_id = $1",
            [memberId]
        );
        const climbRef = await pool.query(
            "SELECT COUNT(*) FROM climbs WHERE member_id = $1",
            [memberId]
        );

        const total = parseInt(sessionRef.rows[0].count) +
                       parseInt(driverRef.rows[0].count) +
                       parseInt(climbRef.rows[0].count);

        if (total > 0) {
            return res.status(400).json({ error: "Cannot delete member with existing session or climb history" });
        }

        const result = await pool.query("DELETE FROM members WHERE id = $1 AND group_id = $2", [memberId, groupId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Member not found" });
        }
        res.json({ message: "Member deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete member" });
    }
});

// Get today's bitterballen orders
app.get("/api/bitterballen-orders", async (req, res) => {
    const groupId = req.session.groupId;
    try {
        const result = await pool.query(
            `SELECT s.id, s.session_date, bp.name AS bitterballen_payer_name
             FROM sessions s
             JOIN members bp ON s.bitterballen_payer_id = bp.id
             WHERE s.session_date = CURRENT_DATE AND s.group_id = $1
             ORDER BY s.id DESC`,
            [groupId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch bitterballen orders" });
    }
});

app.get("/bitterballen", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "bitterballen.html"));
});

app.get("/stats", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "stats.html"));
});

app.get("/settings", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "settings.html"));
});

app.get("/info", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "info.html"));
});