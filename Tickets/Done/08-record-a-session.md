# 08 - Record a Session

## Description
Allow users to log a climbing session. Recording a session advances the driving and payment rotations to the next person. Each payment group records sessions independently.

## Tasks
- Create a `sessions` table to store session records (date, driver, payer, group)
- Create a POST `/api/sessions` endpoint to record a session
- Add a button per payment group to record a session
- Advance the driving and payment rotations when a session is recorded
- Show a confirmation after recording

## Done when
- A session can be recorded with one click per group
- The session is stored with the date, who drove, and who paid
- The driving and payment turns advance to the next person
- The page refreshes to show the new current driver/payer

---

## Implementation Steps

### Step 1: Create the sessions table

Open `db/database.js` and add a second CREATE TABLE to `initDatabase()`:

```js
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
```

**What's happening here:**
- `sessions` — a new table that logs each session
- `session_date` — the date of the session, defaults to today
- `driver_id` — who drove (can be NULL if the group doesn't have a carpool, like group 2)
- `payer_id` — who paid for drinks
- `pay_group` — which payment group this session belongs to
- `REFERENCES members(id)` — a **foreign key** that links to the members table. This ensures you can't log a session for a member that doesn't exist

### Step 2: Add the record session endpoint in `server.js`

Add this route after your `/api/payment` route:

```js
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
```

**What's happening here:**
- `pay_group` comes from the request body — it tells us which group is recording a session
- We look up the current driver and the current payer for that group
- We insert a session record with today's date, who drove, and who paid
- **Driving rotation** only advances when group 1 records (they're the ones with the carpool). It finds the next person by `drive_order`, or wraps back to the first if we're at the end
- **Payment rotation** advances for the specific group. Same logic — find the next `pay_order`, or wrap around
- `LIMIT 1` — only gets one row (the next person in line)
- The wrap-around works by selecting the member with the lowest `drive_order`/`pay_order` when there's nobody after the current person

### Step 3: Add record buttons to `index.html`

In `views/index.html`, add this section inside `<main>` after the payment groups div and before the footer:

```html
        <!-- Record Session -->
        <div class="card mt-4">
            <div class="card-body text-center">
                <h5 class="card-title">Record a Session</h5>
                <div class="d-flex justify-content-center gap-3">
                    <button class="btn btn-success" id="recordGroup1">
                        Record Group 1
                    </button>
                    <button class="btn btn-success" id="recordGroup2">
                        Record Group 2
                    </button>
                </div>
                <div id="sessionMessage" class="mt-2"></div>
            </div>
        </div>
    </main>
```

**What's happening here:**
- Two buttons, one per payment group
- `btn-success` — Bootstrap green button (green = go/confirm)
- `gap-3` — adds spacing between the buttons
- `sessionMessage` — empty div for showing confirmation or error messages

### Step 4: Add the JavaScript to record sessions

Open `public/js/app.js` and add this after the `loadPayment()` function:

```js
// Record a session for a group
async function recordSession(payGroup) {
    try {
        const response = await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pay_group: payGroup }),
        });

        const data = await response.json();
        const sessionMessage = document.getElementById("sessionMessage");

        if (response.ok) {
            sessionMessage.innerHTML = `<span class="text-success">${data.message}</span>`;
            // Reload all data to show updated rotations
            loadDriving();
            loadPayment();
        } else {
            sessionMessage.innerHTML = `<span class="text-danger">${data.error}</span>`;
        }
    } catch (err) {
        console.error("Failed to record session:", err);
    }
}

// Button event listeners
document.getElementById("recordGroup1").addEventListener("click", () => recordSession(1));
document.getElementById("recordGroup2").addEventListener("click", () => recordSession(2));
```

**What's happening here:**
- `recordSession(payGroup)` — sends a POST request with the group number
- After a successful recording, it calls `loadDriving()` and `loadPayment()` again to refresh the page with the new current driver/payer
- The event listeners connect each button to the right group number
- No page refresh needed — the data updates in place

### Step 5: Verify

1. Run `npm run dev` and go to `http://localhost:3000`
2. Note who the current driver and current payers are
3. Click **Record Group 1** — you should see "Session recorded" in green
4. The current driver should advance to the next carpool member
5. The Group 1 payer should advance to the next person
6. The Group 2 payer should NOT change (it's independent)
7. Click **Record Group 2** — only the Group 2 payer should advance
8. Keep clicking to test the wrap-around — after the last person, it should loop back to the first
9. Check pgAdmin: the `sessions` table should have rows with dates, driver IDs, and payer IDs
