# 09 - Balance-Based Payments

## Description
Replace the rotation-based payment system with a balance-based system. When you pay for others, your balance goes up (the group owes you). When someone pays for you, your balance goes down (you owe the group). Whoever has the lowest balance (owes the most) pays next.

## How it works
- When you pay for the group, your balance goes up by the **number of people you paid for**
- When someone else pays for your drink, your balance goes **-1**
- Whoever has the **lowest balance** (most negative) pays next
- If someone is absent, their balance stays the same — no special logic needed
- Positive balance = the group owes you. Negative balance = you owe the group.

### Example
4 people present: Nouk pays for Levi, Roel, and Aliona:
- Nouk: **+3** (paid for 3 people)
- Levi: **-1** (got a free drink)
- Roel: **-1** (got a free drink)
- Aliona: **-1** (got a free drink)

Next week, whoever has the lowest balance pays.

## Done when
- Payments are tracked by balance, not rotation
- Absences are handled naturally (absent members' balance stays the same)
- Each group has its own independent balance tracking
- The suggested payer is whoever owes the most (lowest balance)

---

## Implementation Steps

### Step 1: Update the database schema *(already done)*

You've already updated `db/database.js` with `pay_balance` and `session_attendance`. No changes needed here.

### Step 2: Migrate the existing database

Run this in **psql** to drop the old columns (if you haven't already):

```sql
\c whosturn
ALTER TABLE members DROP COLUMN IF EXISTS pay_order;
ALTER TABLE members DROP COLUMN IF EXISTS is_current_payer;
```

Verify with:

```sql
SELECT name, pay_group, pay_balance FROM members;
```

Everyone should have `pay_balance = 0`.

### Step 3: Replace the GET `/api/payment` endpoint in `server.js`

Find the existing `/api/payment` route (lines 66-87) and replace it with:

```js
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
```

**What's happening here:**
- `ORDER BY pay_group, pay_balance ASC, name` — sorts by group, then **lowest balance first** (that person owes the most and should pay next), then alphabetically for ties
- The grouping logic stays the same

### Step 4: Replace the POST `/api/sessions` endpoint in `server.js`

Find the existing `/api/sessions` route (lines 89-187) and replace the entire thing with:

```js
// Record a session
app.post("/api/sessions", async (req, res) => {
    const { pay_group, payer_id, present_ids } = req.body;

    if (!pay_group || !payer_id || !present_ids || present_ids.length === 0) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        // Get current driver
        const driverResult = await pool.query(
            "SELECT * FROM members WHERE is_current_driver = true"
        );
        const currentDriver = driverResult.rows[0] || null;

        // Record the session
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

        // Update balances
        // Payer gets + (number of other present members)
        const otherPresent = present_ids.filter(id => id !== payer_id);
        await pool.query(
            "UPDATE members SET pay_balance = pay_balance + $1 WHERE id = $2",
            [otherPresent.length, payer_id]
        );

        // Every other present member gets -1
        if (otherPresent.length > 0) {
            await pool.query(
                "UPDATE members SET pay_balance = pay_balance - 1 WHERE id = ANY($1)",
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
- The endpoint now accepts `{ pay_group, payer_id, present_ids }`
- **Payer** gets `+ otherPresent.length` (e.g. paid for 3 others → +3)
- **Each other present member** gets `-1` (got a free drink)
- `ANY($1)` — PostgreSQL way to match against an array
- Absent members aren't in `present_ids`, so nothing happens to their balance
- Driving rotation advancement stays the same as before

### Step 5: Remove the static Record Session card from `index.html`

In `views/index.html`, delete the entire Record Session card (lines 74-88):

```html
        <!-- Record Session -->
        <div class="card mt-4">
            ...the whole card...
        </div>
```

Keep the closing `</main>` tag. The record buttons will now be generated dynamically per group by JavaScript.

### Step 6: Replace `loadPayment()` and `recordSession()` in `app.js`

Open `public/js/app.js` and replace everything from `// Load payment rotation per group` onwards (lines 45-117) with:

```js
// Load payment balances per group
async function loadPayment() {
    try {
        const response = await fetch("/api/payment");
        const groups = await response.json();
        const container = document.getElementById("paymentGroups");

        container.innerHTML = Object.keys(groups).map(groupNum => {
            const members = groups[groupNum];
            const suggestedPayer = members[0]; // Lowest balance is first (sorted by server)

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
                                    <span class="badge ${m.pay_balance < 0 ? "bg-danger" : m.pay_balance > 0 ? "bg-success" : "bg-secondary"}">
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

    if (presentIds.length < 2) {
        const msgDiv = document.querySelector(`.session-message-${payGroup}`);
        msgDiv.innerHTML = `<span class="text-danger">At least 2 people must be present</span>`;
        return;
    }

    // Fetch current balances to find the suggested payer among present members
    const response = await fetch("/api/payment");
    const groups = await response.json();
    const members = groups[payGroup];

    // Find the present member with the lowest balance (owes the most)
    const presentMembers = members.filter(m => presentIds.includes(m.id));
    const payer = presentMembers[0]; // Already sorted by lowest balance

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

// Load data when the page is ready
loadMembers();
loadDriving();
loadPayment();
```

**What's happening here:**
- Balances are colour-coded: **red** for negative (owes the group), **green** for positive (group owes them), **grey** for zero
- `members[0]` is the suggested payer — the server already sorts lowest balance first
- Attendance checkboxes default to checked (present) — uncheck absent members
- `presentIds.length < 2` — you need at least 2 people for someone to pay for someone else
- After recording, it re-fetches the balances to find the correct payer among present members
- Record buttons and event listeners are generated dynamically per group

### Step 7: Verify

1. Run `npm run dev` and go to `http://localhost:3000`
2. Everyone should start at balance **0**
3. With all 4 Group 1 members checked, click **Record Group 1**
4. The payer should get **+3** (paid for 3 others), everyone else **-1**
5. The person with the lowest balance should now show as "Next to Pay"
6. Uncheck a member and record — the absent member's balance should stay the same
7. The payer should get fewer points when fewer people are present (e.g. +2 for 3 present)
8. Check pgAdmin: `session_attendance` should show who was present, balances should match
