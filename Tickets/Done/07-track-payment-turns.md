# 07 - Track Payment Turns

## Description
Implement a rotation system to track whose turn it is to pay for drinks. Members are split into payment groups that each have their own independent rotation. Group 1: Nouk, Levi, Roel, Aliona. Group 2: Peter, Sander.

## Tasks
- Add `pay_group`, `pay_order`, and `is_current_payer` columns to the members table
- Write logic to determine whose turn it is to pay per group
- Display the current payer per group prominently on the page
- Show the upcoming payment order per group

## Done when
- The app shows whose turn it is to pay for each group
- Each group has its own independent rotation
- The rotation order is visible per group

---

## Implementation Steps

### Step 1: Add columns to the members table

Open **psql** and run:

```sql
\c whosturn
ALTER TABLE members ADD COLUMN pay_group INTEGER;
ALTER TABLE members ADD COLUMN pay_order INTEGER;
ALTER TABLE members ADD COLUMN is_current_payer BOOLEAN NOT NULL DEFAULT false;
```

Then assign groups and payment order:

```sql
-- Group 1
UPDATE members SET pay_group = 1, pay_order = 1, is_current_payer = true WHERE name = 'Nouk';
UPDATE members SET pay_group = 1, pay_order = 2 WHERE name = 'Levi';
UPDATE members SET pay_group = 1, pay_order = 3 WHERE name = 'Roel';
UPDATE members SET pay_group = 1, pay_order = 4 WHERE name = 'Aliona';

-- Group 2
UPDATE members SET pay_group = 2, pay_order = 1, is_current_payer = true WHERE name = 'Peter';
UPDATE members SET pay_group = 2, pay_order = 2 WHERE name = 'Sander';
```

**What's happening here:**
- `pay_group` — which payment group the member belongs to (1 or 2)
- `pay_order` — the position within their group's rotation (starts at 1 per group)
- `is_current_payer` — one person per group is marked as the current payer
- Each group's `pay_order` starts at 1 independently

### Step 2: Update `initDatabase()` to include the new columns

Open `db/database.js` and add the three new columns to the CREATE TABLE statement:

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
    console.log("Database initialized — members table ready");
}
```

**What's happening here:**
- `pay_group` is new compared to the driving setup — it splits members into separate rotations
- This ensures fresh setups get the complete schema

### Step 3: Add the API endpoint in `server.js`

Add this route after your `/api/driving` route:

```js
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
```

**What's happening here:**
- `ORDER BY pay_group, pay_order` — sorts by group first, then by position within the group
- The `forEach` loop organizes the flat list into an object like `{ "1": [...], "2": [...] }`
- This way the frontend gets each group's members separately and can render them independently
- `WHERE pay_group IS NOT NULL` — only includes members that are assigned to a payment group

### Step 4: Add the payment section to `index.html`

In `views/index.html`, add this inside `<main>` after the Driving Rotation card and before the Member List card:

```html
        <!-- Payment Groups -->
        <div id="paymentGroups">
            <!-- Payment groups loaded by JavaScript -->
        </div>
```

**What's happening here:**
- Instead of hardcoding cards for each group, we use one empty container
- JavaScript will create the cards dynamically based on how many groups exist
- This way if you ever add a group 3, it just works

### Step 5: Add the JavaScript to load payment data

Open `public/js/app.js` and add this function after `loadDriving()`:

```js
// Load payment rotation per group
async function loadPayment() {
    try {
        const response = await fetch("/api/payment");
        const groups = await response.json();
        const container = document.getElementById("paymentGroups");

        container.innerHTML = Object.keys(groups).map(groupNum => {
            const members = groups[groupNum];
            const current = members.find(m => m.is_current_payer);

            return `
                <!-- Group ${groupNum} Current Payer -->
                <div class="card mt-4">
                    <div class="card-body text-center">
                        <h5 class="card-title">Paying - Group ${groupNum}</h5>
                        <p class="display-6">${current ? current.name : "No payer set"}</p>
                    </div>
                </div>

                <!-- Group ${groupNum} Rotation -->
                <div class="card mt-3">
                    <div class="card-body">
                        <h5 class="card-title">Payment Order - Group ${groupNum}</h5>
                        <ol class="list-group list-group-numbered list-group-flush">
                            ${members.map(m => `
                                <li class="list-group-item ${m.is_current_payer ? "active" : ""}">
                                    ${m.name}
                                </li>
                            `).join("")}
                        </ol>
                    </div>
                </div>
            `;
        }).join("");
    } catch (err) {
        console.error("Failed to load payment data:", err);
    }
}
```

Then update the bottom of the file to call all three functions:

```js
// Load data when the page is ready
loadMembers();
loadDriving();
loadPayment();
```

**What's happening here:**
- `Object.keys(groups)` — gets the group numbers (`["1", "2"]`)
- For each group, we create two cards: current payer (big text) and rotation order (numbered list)
- `members.find(m => m.is_current_payer)` — finds the current payer within that specific group
- The cards are generated dynamically — if you add more groups later, they'll appear automatically

### Step 6: Verify

1. Run `npm run dev` and go to `http://localhost:3000`
2. You should see **two** payment sections: Group 1 and Group 2
3. Group 1 should show Nouk, Levi, Roel, Aliona with Nouk as current payer
4. Group 2 should show Peter, Sander with Peter as current payer
5. Each group has its own highlighted current payer
6. Test the API at `http://localhost:3000/api/payment` ��� you should see the members organized by group
