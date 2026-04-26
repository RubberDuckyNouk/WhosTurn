# 12 - Bitterballen Index

## Description
Create a page where members can log what they climb, keep track of their personal record grade. Bitterballen index goes up based on group efforts.

## Done when
- App has entry option for name and grade
- Nr of climbs and highest grade of current session is shown per member
- Entered climb is stored with current date in the database
- All climbs per member are stored in the database
- App shows personal record grade for each member
- App shows 'bitterballen index' which resets to 0% before every session (thursday) and reaches 100% if all members climbed at their PR. If one member sets a new PR this counts the same as 2 people climbing at their max level.
- Bitterballen index is a thermometer style progress bar.
- Text explaining the current index reached is displayed.

## Notes
- Ticket 13 (Climbing Tracker graph) builds on this ticket's data. Do this one first.

---

## Implementation Steps

### Step 1: Add the `climbs` table in `db/database.js`

Add this after the `session_attendance` table creation:

```js
    await pool.query(`
        CREATE TABLE IF NOT EXISTS climbs (
            id SERIAL PRIMARY KEY,
            member_id INTEGER NOT NULL REFERENCES members(id),
            grade VARCHAR(10) NOT NULL,
            grade_value INTEGER NOT NULL,
            climb_date DATE NOT NULL DEFAULT CURRENT_DATE
        )
    `);
```

`grade` stores the display string (e.g. "6a+"), `grade_value` stores a numeric value for comparison/sorting.

### Step 2: Add API endpoints in `server.js`

Add a grade mapping at the top of `server.js` (after the requires):

```js
// Climbing grade order (French bouldering scale)
const GRADES = [
    "4", "4+", "5a", "5a+", "5b", "5b+", "5c", "5c+",
    "6a", "6a+", "6b", "6b+", "6c", "6c+",
    "7a", "7a+", "7b", "7b+", "7c", "7c+",
    "8a", "8a+", "8b", "8b+"
];
```

**POST `/api/climbs`** — log a climb:

```js
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
```

**GET `/api/climbs/current`** — get current session climbs (since last Thursday) and PRs:

```js
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

            data.push({
                id: member.id,
                name: member.name,
                pr: prAll.rows[0]?.grade || null,
                session_climbs: sessionClimbs.rows.length,
                session_high: sessionClimbs.rows[0]?.grade || null,
                is_new_pr: isNewPr,
                climbed_at_pr: climbedAtPr
            });
        }

        // Calculate bitterballen index
        // Each member at PR = 1 point, new PR = 2 points
        // 100% = total_members points
        let points = 0;
        for (const m of data) {
            if (m.is_new_pr) points += 2;
            else if (m.climbed_at_pr) points += 1;
        }
        const index = Math.min(100, Math.round((points / members.length) * 100));

        res.json({ members: data, bitterballen_index: index });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch climb data" });
    }
});
```

**GET `/api/grades`** — return the grade list for the dropdown:

```js
// Get available grades
app.get("/api/grades", (req, res) => {
    res.json(GRADES);
});
```

### Step 3: Create the Bitterballen page `views/bitterballen.html`

Create a new HTML page with the same layout as `index.html` (navbar, Bootstrap, footer). Include:

- A thermometer-style progress bar for the bitterballen index
- A text explanation of the current index
- A table showing each member's: name, PR, session climbs count, session high grade, and whether they set a new PR
- A form to log a climb: member dropdown, grade dropdown, date picker (default today), submit button

### Step 4: Serve the page in `server.js`

```js
app.get("/bitterballen", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "bitterballen.html"));
});
```

### Step 5: Add navbar link in both `index.html` and `bitterballen.html`

Add to the navbar `<ul>`:

```html
<li class="nav-item">
    <a class="nav-link" href="/bitterballen">Bitterballen</a>
</li>
```

### Step 6: Create `public/js/bitterballen.js`

This script handles:
- Loading and displaying the bitterballen index (thermometer progress bar)
- Loading and displaying the member table with PRs and session stats
- Populating the member and grade dropdowns
- Submitting new climbs via POST
- Refreshing the display after logging a climb

The thermometer can be a Bootstrap `progress-bar` styled vertically or a tall narrow `div` with a fill that goes from bottom to top. Use colour stops: red (0-33%), yellow (34-66%), green (67-100%).

The explanation text should describe the current state, e.g.:
- 0%: "Nobody has climbed at their max yet. Get going!"
- 1-49%: "Some effort, but the bitterballen are still frozen..."
- 50-99%: "Getting warm! The bitterballen are almost ready!"
- 100%: "BITTERBALLEN! Everyone crushed it!"

### Step 7: Verify

1. Run `npm run dev` and go to `http://localhost:3000/bitterballen`
2. Log a few climbs for different members
3. Check that PRs update correctly
4. Check that the bitterballen index goes up when people climb at/above their PR
5. Check that session data resets the display each Thursday (climbs before Thursday don't count for the current session)
6. Verify the thermometer and explanation text update
