# 03 - Create HTML Layout

## Description
Build the main HTML page with Bootstrap 5, including a navbar, main content area, and footer. This will be the single page the app lives on.

## Tasks
- Create `views/index.html` with Bootstrap 5 via CDN
- Add a navbar with the app name "WhosTurn"
- Add a `<main>` container for page content
- Add a simple footer
- Serve `index.html` from the GET `/` route
- Link a custom `public/css/style.css`

## Done when
- The page loads with Bootstrap styling
- Navbar, content area, and footer are visible
- The page is responsive (collapses on mobile)

---

## Implementation Steps

### Step 1: Fix the CSS path in `index.html`

Find this line in `<head>`:

```html
<link rel="stylesheet" href="public/css/style.css">
```

Change it to:

```html
<link rel="stylesheet" href="/css/style.css">
```

**What's happening here:**
- Express serves everything inside the `public/` folder at the root URL. So the file `public/css/style.css` is accessible at `/css/style.css` in the browser
- With the old path the browser was looking for a file called `public/css/style.css` as a URL, which doesn't exist as a route — so the CSS never loaded

### Step 2: Add the navbar

Find the `<body>` opening tag and add this navbar right after it, before `<main>`:

```html
<body>
    <!-- Navigation -->
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <div class="container">
            <a class="navbar-brand" href="/">WhosTurn</a>

            <!-- Hamburger button (shows on small screens) -->
            <button class="navbar-toggler" type="button"
                    data-bs-toggle="collapse" data-bs-target="#mainNav"
                    aria-controls="mainNav" aria-expanded="false"
                    aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button>

            <!-- Links (collapse into hamburger on small screens) -->
            <div class="collapse navbar-collapse" id="mainNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item">
                        <a class="nav-link active" href="/">Home</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>
```

**What's happening here:**
- `navbar-expand-lg` — on large screens the links are shown normally, on smaller screens they collapse into a hamburger menu
- `navbar-dark bg-dark` — dark background with white text
- `navbar-brand` — the app name "WhosTurn" on the left side
- `navbar-toggler` + `data-bs-toggle="collapse"` — the hamburger button that appears on mobile. It toggles the element with `id="mainNav"`
- `ms-auto` on the `<ul>` — pushes the nav links to the right
- We only have a "Home" link for now — more links can be added later

### Step 3: Add content to `<main>`

Replace the empty `<main>` block with:

```html
    <main class="container my-4">
        <h1>Whose turn is it?</h1>
        <p>Welcome to the climbing group turn tracker.</p>
    </main>
```

**What's happening here:**
- `container` — a Bootstrap class that centers the content and adds horizontal padding
- `my-4` — adds vertical margin (top and bottom) so the content doesn't stick to the navbar and footer
- The heading and paragraph are placeholder content so you can see the layout is working. This will be replaced with real content in later tickets

### Step 4: Add the Bootstrap JS bundle before `</body>`

Add this line right before the closing `</body>` tag:

```html
    <!-- Bootstrap 5 JS Bundle -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>
</body>
```

**What's happening here:**
- Bootstrap's CSS handles the look, but interactive features like the hamburger menu need JavaScript
- `bootstrap.bundle.min.js` includes both Bootstrap's JS and Popper.js (used for dropdowns and tooltips)
- Without this, clicking the hamburger button on mobile won't do anything

### Step 5: Update `style.css` for the sticky footer layout

Replace the content of `public/css/style.css` with:

```css
body {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
}

main {
    flex: 1;
}

footer {
    background-color: #212326;
    color: #dddddd;
    text-align: center;
    padding: 1.5rem 0;
}

/* Footer social links */
footer a {
    color: #dddddd;
    transition: opacity 0.2s;
    text-decoration: none;
}

footer a:hover {
    opacity: 0.8;
    text-decoration: none;
}
```

**What's happening here:**
- `display: flex` + `flex-direction: column` on `body` — stacks everything vertically (navbar, main, footer)
- `min-height: 100vh` — the body fills at least the full screen height
- `flex: 1` on `main` — the main content stretches to fill all available space, pushing the footer to the bottom even when there's little content
- Removed `margin-top: auto` from footer — the flexbox layout handles that now
- Changed `var(--color-accent)` to `#dddddd` for the links — that CSS variable wasn't defined so the link colours weren't showing

### Step 6: Verify

1. Run `npm run dev` and go to `http://localhost:3000`
2. You should see a **dark navbar** at the top with "WhosTurn" on the left and "Home" on the right
3. The **main content** should show the heading and welcome text
4. The **footer** should be at the bottom with your LinkedIn and GitHub icons
5. Resize the browser narrow — the nav link should collapse into a **hamburger icon**. Click it to toggle the menu
6. Right-click → Inspect → check the Console tab for any errors (there should be none)
