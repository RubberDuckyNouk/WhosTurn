# 16 - User Accounts

## Description
Add personal user accounts with email/password authentication. Users sign up, log in, and stay logged in via a persistent session cookie. This is the foundation for multi-group support — all subsequent tickets depend on this.

## Dependencies
None (but all other multi-group tickets depend on this).

## Done when
- User can sign up with display name, email, and password
- User can log in and stays logged in for 30 days
- User can log out
- `/api/auth/me` returns the logged-in user
- Passwords are hashed with bcrypt (never stored in plain text)
- Sessions persist across server restarts (stored in Postgres)
- Existing pages still work (no auth required yet — that comes in ticket 18)

---

## Implementation Steps

### Step 1: Install dependencies

```bash
npm install bcrypt express-session connect-pg-simple
```

This adds:
- `bcrypt` — password hashing
- `express-session` — session middleware
- `connect-pg-simple` — stores sessions in PostgreSQL instead of memory

### Step 2: Add `users` table to `db/database.js`

Add this query inside `initDatabase()`, **before** the existing `members` table creation:

```js
await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
`);
```

The `users` table must be created before `members` because ticket 19 will add a `user_id` foreign key on `members`.

### Step 3: Configure express-session in `server.js`

Add these requires at the top of `server.js`, after the existing requires:

```js
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcrypt");
```

Add the session middleware **after** `app.use(express.json())` and **before** any route definitions. This is important — the session must be available to all routes.

```js
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: "user_sessions",   // avoids clash with existing "sessions" table
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,  // 30 days
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
    }
}));
```

Also add `SESSION_SECRET` to `.env`:

```
SESSION_SECRET=some-random-string-here
```

Generate a random string for production. The `dev-secret-change-me` fallback is only for local development.

**Note:** `secure: true` requires HTTPS. Setting it conditionally on `NODE_ENV` means cookies work over HTTP in dev and require HTTPS in production.

### Step 4: Add auth API endpoints in `server.js`

Add these routes after the session middleware setup, before the existing page/API routes.

#### `POST /api/auth/signup`

```js
const SALT_ROUNDS = 10;

app.post("/api/auth/signup", async (req, res) => {
    const { email, password, display_name } = req.body;

    if (!email || !password || !display_name) {
        return res.status(400).json({ error: "All fields are required" });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    try {
        // Check if email already exists
        const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: "Email already registered" });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const result = await pool.query(
            "INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name",
            [email, passwordHash, display_name]
        );

        const user = result.rows[0];
        req.session.userId = user.id;

        res.status(201).json({ id: user.id, email: user.email, display_name: user.display_name });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create account" });
    }
});
```

#### `POST /api/auth/login`

```js
app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }

    try {
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        req.session.userId = user.id;

        res.json({ id: user.id, email: user.email, display_name: user.display_name });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Login failed" });
    }
});
```

**Note:** Both login failure cases (bad email, bad password) return the same generic message to avoid leaking whether an email is registered.

#### `POST /api/auth/logout`

```js
app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: "Logout failed" });
        }
        res.clearCookie("connect.sid");
        res.json({ message: "Logged out" });
    });
});
```

#### `GET /api/auth/me`

```js
app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: "Not logged in" });
    }

    try {
        const result = await pool.query(
            "SELECT id, email, display_name FROM users WHERE id = $1",
            [req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: "User not found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch user" });
    }
});
```

#### `requireLogin` middleware

Define this as a reusable function (after the auth routes, before the existing routes). Not used yet in this ticket, but needed for tickets 17–19.

```js
function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: "Login required" });
    }
    next();
}
```

### Step 5: Add page routes in `server.js`

Add these alongside the existing page routes:

```js
app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.get("/signup", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "signup.html"));
});
```

### Step 6: Create `views/login.html`

Minimal page — same head/footer structure as existing pages but **no navbar** (user isn't logged in yet).

```html
<!doctype html>
<html>

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Log In — WhosTurn</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <link rel="stylesheet" href="/css/style.css">
</head>

<body>
    <main class="container my-5" style="max-width: 420px;">
        <h1 class="text-center mb-4">WhosTurn</h1>
        <div class="card">
            <div class="card-body">
                <h5 class="card-title">Log In</h5>
                <div id="errorMsg" class="alert alert-danger d-none"></div>
                <form id="loginForm">
                    <div class="mb-3">
                        <label for="email" class="form-label">Email</label>
                        <input type="email" class="form-control" id="email" required>
                    </div>
                    <div class="mb-3">
                        <label for="password" class="form-label">Password</label>
                        <input type="password" class="form-control" id="password" required>
                    </div>
                    <button type="submit" class="btn btn-primary w-100">Log In</button>
                </form>
                <p class="text-center mt-3 mb-0">
                    Don't have an account? <a href="/signup">Sign up</a>
                </p>
            </div>
        </div>
    </main>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>
    <script src="/js/auth.js"></script>
    <script src="http://localhost:35729/livereload.js"></script>
</body>
</html>
```

### Step 7: Create `views/signup.html`

Same structure, with an extra field for display name:

```html
<!doctype html>
<html>

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sign Up — WhosTurn</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <link rel="stylesheet" href="/css/style.css">
</head>

<body>
    <main class="container my-5" style="max-width: 420px;">
        <h1 class="text-center mb-4">WhosTurn</h1>
        <div class="card">
            <div class="card-body">
                <h5 class="card-title">Sign Up</h5>
                <div id="errorMsg" class="alert alert-danger d-none"></div>
                <form id="signupForm">
                    <div class="mb-3">
                        <label for="display_name" class="form-label">Display Name</label>
                        <input type="text" class="form-control" id="display_name" required>
                    </div>
                    <div class="mb-3">
                        <label for="email" class="form-label">Email</label>
                        <input type="email" class="form-control" id="email" required>
                    </div>
                    <div class="mb-3">
                        <label for="password" class="form-label">Password</label>
                        <input type="password" class="form-control" id="password" minlength="6" required>
                    </div>
                    <button type="submit" class="btn btn-primary w-100">Sign Up</button>
                </form>
                <p class="text-center mt-3 mb-0">
                    Already have an account? <a href="/login">Log in</a>
                </p>
            </div>
        </div>
    </main>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>
    <script src="/js/auth.js"></script>
    <script src="http://localhost:35729/livereload.js"></script>
</body>
</html>
```

### Step 8: Create `public/js/auth.js`

One file handles both pages. Detects which form exists and attaches the right handler.

```js
function showError(msg) {
    const el = document.getElementById("errorMsg");
    el.textContent = msg;
    el.classList.remove("d-none");
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (res.ok) {
                window.location.href = "/";
            } else {
                showError(data.error);
            }
        } catch (err) {
            showError("Something went wrong. Try again.");
        }
    });
}

const signupForm = document.getElementById("signupForm");
if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const display_name = document.getElementById("display_name").value;
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        try {
            const res = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ display_name, email, password })
            });
            const data = await res.json();

            if (res.ok) {
                window.location.href = "/";
            } else {
                showError(data.error);
            }
        } catch (err) {
            showError("Something went wrong. Try again.");
        }
    });
}
```

### Step 9: Add user info + logout to existing navbars

Add a small JS snippet to every page that has a navbar. This fetches `/api/auth/me` and, if logged in, shows the user's name and a logout button in the navbar.

Add this element inside the `<div class="collapse navbar-collapse" id="mainNav">`, **after** the `<ul>`:

```html
<span id="userNav" class="navbar-text ms-3 d-none">
    <span id="navUserName"></span>
    <button id="logoutBtn" class="btn btn-sm btn-outline-light ms-2">Logout</button>
</span>
```

Add this to every page that has a navbar (`index.html`, `bitterballen.html`, `stats.html`).

Then create `public/js/navbar.js`:

```js
(async function () {
    try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return;

        const user = await res.json();
        const userNav = document.getElementById("userNav");
        const navUserName = document.getElementById("navUserName");

        if (userNav && navUserName) {
            navUserName.textContent = user.display_name;
            userNav.classList.remove("d-none");
        }

        const logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
            });
        }
    } catch (err) {
        // Not logged in — that's fine, nav stays as-is
    }
})();
```

Add `<script src="/js/navbar.js"></script>` to `index.html`, `bitterballen.html`, and `stats.html` (after Bootstrap JS, before livereload).

### Step 10: Verify

1. `npm run dev`
2. Go to `http://localhost:3000/signup` — create an account
3. After signup, you should be redirected to `/` and the navbar should show your display name + logout button
4. Click logout — should redirect to `/login`
5. Log in with the same email/password — should redirect to `/` again, name visible in navbar
6. Close the browser, reopen `http://localhost:3000/` — should still be logged in (30-day cookie)
7. All existing pages (`/`, `/bitterballen`, `/stats`) still work without requiring login (auth enforcement comes in ticket 18)
8. Check the database: `SELECT * FROM users;` should show your account with a hashed password (not plain text)
9. `SELECT * FROM user_sessions;` should show a session row
