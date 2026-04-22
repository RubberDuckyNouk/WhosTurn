# 02 - Set Up Express Server

## Description
Create a basic Express server that serves a test page, using nodemon for automatic restarts during development.

## Tasks
- Create `server.js` with a basic Express app
- Serve static files from `public/`
- Add a GET `/` route that sends a simple test response
- Verify the server starts with `npm run dev`

## Done when
- Server runs on a configured port (e.g. 3000)
- Visiting `http://localhost:3000` shows a response
- Nodemon restarts the server on file changes

---

## Implementation Steps

### Step 1: Fix the scripts in `package.json`

Your `package.json` currently points to `index.js`, but we want to use `server.js`. Open `package.json` and change the `"main"` and `"scripts"` to use `server.js`:

```json
"main": "server.js",
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js"
}
```

**What's happening here:**
- The scripts were pointing to `index.js` from `npm init`, but our entry point is `server.js`
- This makes sure `npm start` and `npm run dev` both run the correct file

### Step 2: Create `server.js`

Create a new file called `server.js` in the project root with this content:

```js
const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, "public")));

// Test route
app.get("/", (req, res) => {
  res.send("WhosTurn is running!");
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

**What's happening here:**
- `require("express")` — loads the Express library
- `require("path")` — built-in Node.js module for working with file paths
- `express()` — creates an Express application
- `app.use(express.static(...))` — tells Express to serve any files inside `public/` directly to the browser (CSS, JS, images). If someone visits `/css/style.css`, Express will look for `public/css/style.css`
- `app.get("/", ...)` — defines what happens when someone visits the homepage. For now it just sends a text message
- `app.listen(PORT, ...)` — starts the server and listens for requests on port 3000. The callback runs once the server is ready
- `__dirname` — a special Node.js variable that contains the full path to the folder where `server.js` lives. This ensures the path works no matter where you run the command from

### Step 3: Verify

1. Run `npm run dev` in the terminal
2. You should see `Server running on http://localhost:3000` in the terminal
3. Open your browser and go to `http://localhost:3000`
4. You should see the text **"WhosTurn is running!"**
5. Try changing the text in `server.js` (e.g. to "Hello!") and save — nodemon should restart the server automatically, and refreshing the browser shows the new text
