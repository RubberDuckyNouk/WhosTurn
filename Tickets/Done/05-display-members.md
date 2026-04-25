# 05 - Display Members

## Description
Fetch all members from the database and display them on the page so users can see who is in the group.

## Tasks
- Create a GET `/api/members` endpoint that returns all members as JSON
- Write a JavaScript function that fetches and renders the member list
- Show each member's name and whether they're in the carpool

## Done when
- All members are displayed on the page
- Carpool status is visible for each member

---

## Implementation Steps

### Step 1: Add some test members to the database

Before we can display members, we need some data. Open **psql** or **pgAdmin** and run:

```sql
\c whosturn
INSERT INTO members (name, in_carpool) VALUES ('Nouk', true);
INSERT INTO members (name, in_carpool) VALUES ('Levi', true);
INSERT INTO members (name, in_carpool) VALUES ('Roel', true);
INSERT INTO members (name, in_carpool) VALUES ('Peter', false);
INSERT INTO members (name, in_carpool) VALUES ('Sander', false);
INSERT INTO members (name, in_carpool) VALUES ('Aliona', false);
```

Replace these with your actual climbing group members. Use `true` for people in the carpool, `false` for those who aren't.

**What's happening here:**
- We're adding rows to the `members` table manually since there's no add form
- Each member gets an auto-generated `id` from the `SERIAL` column
- You can always add, edit, or remove members later through psql or pgAdmin

### Step 2: Add the GET endpoint in `server.js`

Add this route after your existing GET `/` route:

```js
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
```

**What's happening here:**
- `app.get("/api/members", ...)` — a GET route that returns data (unlike POST which sends data)
- `pool.query("SELECT * FROM members ORDER BY name")` — fetches all rows from the members table, sorted alphabetically
- `result.rows` — the `pg` library puts the query results in a `.rows` array
- `res.json(...)` — sends the array as JSON to the browser
- The `try/catch` handles database errors so the server doesn't crash

### Step 3: Add the member list to `index.html`

In `views/index.html`, add this section inside `<main>` after the welcome text:

```html
    <main class="container my-4">
        <h1>Whose turn is it?</h1>
        <p>Welcome to the climbing group turn tracker.</p>

        <!-- Member List -->
        <div class="card mt-4">
            <div class="card-body">
                <h5 class="card-title">Members</h5>
                <ul id="memberList" class="list-group list-group-flush">
                    <!-- Members will be loaded here by JavaScript -->
                </ul>
            </div>
        </div>
    </main>
```

**What's happening here:**
- `id="memberList"` — an empty list that our JavaScript will fill with member data
- `list-group list-group-flush` — Bootstrap classes that style the list items cleanly without outer borders
- The comment is a placeholder — the actual member names get inserted by JavaScript

### Step 4: Create the client-side JavaScript

Open `public/js/app.js` (it should be empty) and add this content:

```js
async function loadMembers() {
    try {
        const response = await fetch("/api/members");
        const members = await response.json();
        const memberList = document.getElementById("memberList");

        memberList.innerHTML = members.map(member => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                ${member.name}
                ${member.in_carpool
                    ? '<span class="badge bg-primary">Carpool</span>'
                    : ""}
            </li>
        `).join("");
    } catch (err) {
        console.error("Failed to load members:", err);
    }
}

// Load members when the page is ready
loadMembers();
```

**What's happening here:**
- `async function loadMembers()` — a function that fetches members from our API and displays them
- `fetch("/api/members")` — calls the GET endpoint we made in step 2
- `response.json()` — parses the JSON response into a JavaScript array
- `members.map(...)` — loops over each member and creates an HTML list item for them
- `d-flex justify-content-between align-items-center` — Bootstrap flexbox classes that put the name on the left and the badge on the right
- `badge bg-primary` — a small blue label that shows "Carpool" next to carpool members
- The ternary `member.in_carpool ? ... : ""` — only shows the badge if the member is in the carpool
- `.join("")` — combines all the list items into one HTML string
- `memberList.innerHTML = ...` — puts the generated HTML inside the `<ul>` element
- `loadMembers()` at the bottom — calls the function immediately when the script loads

### Step 5: Link the script in `index.html`

Add this line in `views/index.html` after the Bootstrap JS bundle and before the livereload script:

```html
    <!-- App JavaScript -->
    <script src="/js/app.js"></script>

    <!-- Live reload -->
    <script src="http://localhost:35729/livereload.js"></script>
```

### Step 6: Verify

1. Run `npm run dev` and go to `http://localhost:3000`
2. You should see a "Members" card with the names you inserted in step 1
3. Members in the carpool should have a blue "Carpool" badge next to their name
4. You can also test the API directly by visiting `http://localhost:3000/api/members` in your browser — you should see the raw JSON data
