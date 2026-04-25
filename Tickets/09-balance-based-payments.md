# 09 - Balance-Based Payments

## Description
Replace the rotation-based payment system with a balance-based system. Each member has a balance that goes up when someone else pays for their drink, and down when they pay. Whoever has the highest balance pays next. This naturally handles absences without any special logic.

## How it works
- When a session is recorded, the payer gets **-1** and every other present member gets **+1**
- Whoever has the **highest balance** is shown as "next to pay"
- If someone is absent, they don't get +1 that week — their balance stays the same
- Ties are broken by who paid least recently

## Done when
- Payments are tracked by balance, not rotation
- Absences are handled naturally (absent members' balance stays the same)
- Each group has its own independent balance tracking
- The suggested payer is whoever owes the most

---

## Implementation Steps

### Step 1: Update the database schema

Open `db/database.js` and replace the entire `initDatabase` function with:

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

    console.log("Database initialized — tables ready");
}
```

**What's happening here:**
- `pay_balance` replaces `pay_order` and `is_current_payer` — it's a single number that tracks fairness
- `pay_group` stays — groups still record independently
- `session_attendance` is a new table that records who was present at each session. This is needed for the history page later
- Each row in `session_attendance` links a session to a member who was present

### Step 2: Update the existing database

Since your database already has the old columns, run this in **psql** to migrate:

```sql
\c whosturn

-- Add the new column
ALTER TABLE members ADD COLUMN IF NOT EXISTS pay_balance INTEGER NOT NULL DEFAULT 0;

-- Remove the old columns
ALTER TABLE members DROP COLUMN IF EXISTS pay_order;
ALTER TABLE members DROP COLUMN IF EXISTS is_current_payer;

-- Create the attendance table
CREATE TABLE IF NOT EXISTS session_attendance (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES sessions(id),
    member_id INTEGER NOT NULL REFERENCES members(id)
);
```

**What's happening here:**
- `ADD COLUMN IF NOT EXISTS` — adds `pay_balance` without breaking anything if it already exists
- `DROP COLUMN IF EXISTS` — removes the old rotation columns we no longer need
- Everyone starts at balance 0, which is fair since we're starting fresh

### Step 3: Replace the GET `/api/payment` endpoint in `server.js`

Find the existing `/api/payment` route (lines 66-87) and replace it with:

```js
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
```

**What's happening here:**
- `ORDER BY pay_group, pay_balance DESC, name` — sorts by group, then highest balance first (that person should pay next), then alphabetically for ties
- The grouping logic is the same as before — the frontend gets members organized by group

### Step 4: Replace the POST `/api/sessions` endpoint in `server.js`

Find the existing `/api/sessions` route (lines 89-187) and replace it with:

```js
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
```

**What's happening here:**
- The endpoint now accepts `{ pay_group, payer_id, present_ids }` instead of just `{ pay_group }`
- `payer_id` — the member who is paying (chosen by the frontend, based on highest balance)
- `present_ids` — array of member IDs who are present this session
- `RETURNING id` — gets the new session's ID so we can link attendance records to it
- `pay_balance - 1` for the payer, `pay_balance + 1` for everyone else who's present
- `ANY($1)` — PostgreSQL way to match against an array of values (like `WHERE id IN (1, 2, 3)`)
- Absent members are simply not in `present_ids`, so their balance stays the same — no special logic needed
- Driving rotation advancement stays the same

### Step 5: Replace the payment section in `index.html`

In `views/index.html`, replace the Payment Groups div (line 69-72) and the Record Session card (lines 74-88) with:

```html
        <!-- Payment Groups -->
        <div id="paymentGroups">
            <!-- Payment groups loaded by JavaScript -->
        </div>
```

The Record Session buttons will now be generated dynamically per group by JavaScript (inside each group's card), so remove the old static buttons card entirely.

**What's happening here:**
- The payment groups div stays the same — JavaScript fills it in
- The static "Record Group 1/2" buttons are removed because each group will have its own attendance checkboxes and record button, generated dynamically

### Step 6: Replace `loadPayment()` and `recordSession()` in `app.js`

Open `public/js/app.js` and replace everything from `// Load payment rotation per group` onwards with:

```js
// Load payment balances per group
async function loadPayment() {
    try {
        const response = await fetch("/api/payment");
        const groups = await response.json();
        const container = document.getElementById("paymentGroups");

        container.innerHTML = Object.keys(groups).map(groupNum => {
            const members = groups[groupNum];
            const suggestedPayer = members[0]; // Highest balance is first (sorted by server)

            return `
                <!-- Group ${groupNum} Next Payer -->
                <div class="card mt-4">
                    <div class="card-body text-center">
                        <h5 class="card-title">Next to Pay - Group ${groupNum}</h5>
                        <p class="display-6">${suggestedPayer ? suggestedPayer.name : "No members"}</p>
                    </div>
                </div>

                <!-- Group ${groupNum} Balances -->
                <div class="card mt-3">
                    <div class="card-body">
                        <h5 class="card-title">Balances - Group ${groupNum}</h5>
                        <ul class="list-group list-group-flush">
                            ${members.map(m => `
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    ${m.name}
                                    <span class="badge ${m.pay_balance > 0 ? "bg-danger" : m.pay_balance < 0 ? "bg-success" : "bg-secondary"}">
                                        ${m.pay_balance > 0 ? "+" : ""}${m.pay_balance}
                                    </span>
                                </li>
                            `).join("")}
                        </ul>
                    </div>
                </div>

                <!-- Group ${groupNum} Record Session -->
                <div class="card mt-3">
                    <div class="card-body">
                        <h5 class="card-title">Record Session - Group ${groupNum}</h5>
                        <p class="text-muted">Check who's present:</p>
                        ${members.map(m => `
                            <div class="form-check">
                                <input class="form-check-input attendance-${groupNum}"
                                       type="checkbox" value="${m.id}"
                                       id="attend-${m.id}" checked>
                                <label class="form-check-label" for="attend-${m.id}">
                                    ${m.name}
                                </label>
                            </div>
                        `).join("")}
                        <button class="btn btn-success mt-3 record-btn" data-group="${groupNum}">
                            Record Group ${groupNum}
                        </button>
                        <div class="session-message-${groupNum} mt-2"></div>
                    </div>
                </div>
            `;
        }).join("");

        // Add event listeners to record buttons
        document.querySelectorAll(".record-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const groupNum = btn.dataset.group;
                recordSession(parseInt(groupNum));
            });
        });
    } catch (err) {
        console.error("Failed to load payment data:", err);
    }
}

// Record a session for a group
async function recordSession(payGroup) {
    // Get checked (present) member IDs
    const checkboxes = document.querySelectorAll(`.attendance-${payGroup}:checked`);
    const presentIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

    if (presentIds.length === 0) {
        const msgDiv = document.querySelector(`.session-message-${payGroup}`);
        msgDiv.innerHTML = `<span class="text-danger">At least one person must be present</span>`;
        return;
    }

    // Fetch current balances to find the suggested payer among present members
    const response = await fetch("/api/payment");
    const groups = await response.json();
    const members = groups[payGroup];

    // Find the present member with the highest balance
    const presentMembers = members.filter(m => presentIds.includes(m.id));
    const payer = presentMembers[0]; // Already sorted by highest balance

    try {
        const result = await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                pay_group: payGroup,
                payer_id: payer.id,
                present_ids: presentIds
            }),
        });

        const data = await result.json();
        const msgDiv = document.querySelector(`.session-message-${payGroup}`);

        if (result.ok) {
            msgDiv.innerHTML = `<span class="text-success">${payer.name} paid! ${data.message}</span>`;
            loadDriving();
            loadPayment();
        } else {
            msgDiv.innerHTML = `<span class="text-danger">${data.error}</span>`;
        }
    } catch (err) {
        console.error("Failed to record session:", err);
    }
}
```

Also remove the old button event listeners. The bottom of the file should just be:

```js
// Load data when the page is ready
loadMembers();
loadDriving();
loadPayment();
```

**What's happening here:**
- `loadPayment()` now renders three cards per group: who's next to pay, balance list, and a record form
- Balances are shown with coloured badges: **red** for positive (owes the group), **green** for negative (the group owes them), **grey** for zero
- Each group gets attendance checkboxes (all checked by default — uncheck absent members)
- `recordSession()` reads the checkboxes to get present member IDs
- It fetches the current balances to find the suggested payer (highest balance among present members)
- The record button and event listeners are generated dynamically per group
- `data-group` on the button stores which group it belongs to
- After recording, both driving and payment data reload to show updated balances

### Step 7: Verify

1. Run `npm run dev` and go to `http://localhost:3000`
2. Each payment group should show:
   - "Next to Pay" with the member who has the highest balance
   - A balance list (everyone at 0 to start)
   - Attendance checkboxes (all checked)
   - A "Record" button
3. Click "Record Group 1" with everyone checked:
   - The payer (first in the list) should get balance -1
   - Everyone else present should get balance +1
   - "Next to Pay" should update to show the new highest balance
4. Uncheck a member and record again — the absent member's balance should stay the same
5. Check pgAdmin: `session_attendance` should have rows linking sessions to present members
6. The driving rotation should still advance when Group 1 records
