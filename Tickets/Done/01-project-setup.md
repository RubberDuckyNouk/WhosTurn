# 01 - Project Setup

## Description
Set up the base project with Node.js, install dependencies, and create the folder structure for the WhosTurn app.

## Tasks
- Run `npm init` to create `package.json`
- Install dependencies: `express`, `pg`
- Install dev dependencies: `nodemon`
- Create folder structure (`public/`, `public/css/`, `public/js/`, `views/`, `db/`)
- Add a `start` and `dev` script to `package.json`
- Add `node_modules/` to `.gitignore`

## Done when
- `package.json` exists with all dependencies listed
- Folder structure is in place
- `npm run dev` is configured to use nodemon

---

## Implementation Steps

### Step 1: Initialize the project

Open a terminal in the `WhosTurn` folder and run:

```bash
npm init -y
```

This creates a `package.json` with default values. Open it and update the `"name"` and `"description"`:

```json
{
  "name": "whosturn",
  "version": "1.0.0",
  "description": "Turn tracker for our climbing group — driving and paying for drinks",
  "main": "server.js"
}
```

**What's happening here:**
- `npm init -y` — creates a `package.json` with defaults so you don't have to answer questions
- `"main": "server.js"` — tells Node.js which file to run when you start the app

### Step 2: Install dependencies

Run these two commands:

```bash
npm install express better-sqlite3
```

```bash
npm install --save-dev nodemon
```

**What's happening here:**
- `express` — a web framework that makes it easy to create a server and define routes (URLs your app responds to)
- `better-sqlite3` — a fast, simple library to use SQLite databases from Node.js (no separate database server needed)
- `nodemon` — a dev tool that watches your files and automatically restarts the server when you save changes
- `--save-dev` — installs nodemon as a development dependency only (it's not needed in production)

### Step 3: Add scripts to `package.json`

Open `package.json` and replace the `"scripts"` section with:

```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js"
}
```

**What's happening here:**
- `npm start` — runs the server normally with Node.js (used in production)
- `npm run dev` — runs the server with nodemon, which auto-restarts when you edit files (used during development)

### Step 4: Create the folder structure

Create these folders inside the project:

```
WhosTurn/
├── public/
│   ├── css/
│   └── js/
├── views/
└── db/
```

You can create them by running:

```bash
mkdir public
mkdir public/css
mkdir public/js
mkdir views
mkdir db
```

**What's happening here:**
- `public/` — files in here will be served directly to the browser (CSS, JavaScript, images)
- `public/css/` — your stylesheets
- `public/js/` — your client-side JavaScript
- `views/` — your HTML pages
- `db/` — where the SQLite database file will live

### Step 5: Create a `.gitignore` file

Create a file called `.gitignore` in the project root with this content:

```
node_modules/
*.db
```

**What's happening here:**
- `node_modules/` — this folder contains all installed packages and is very large. It shouldn't be in git because anyone can recreate it by running `npm install`
- `*.db` — excludes SQLite database files from git. The database is generated locally and each developer/machine will have their own

### Step 6: Verify

1. Open `package.json` — you should see `express` and `better-sqlite3` under `"dependencies"`, and `nodemon` under `"devDependencies"`
2. Check that all folders exist: `public/`, `public/css/`, `public/js/`, `views/`, `db/`
3. Check that `.gitignore` exists and contains `node_modules/` and `*.db`
4. Run `npm run dev` — it will fail because `server.js` doesn't exist yet, and that's expected! You'll create it in ticket 02
