# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WhosTurn is a turn tracker for a climbing group. It manages **driving rotation** (who drives to the climbing gym) and **payment tracking** (who pays for drinks) using a balance-based fairness system. Built for a small friend group, not a general-purpose app.

## Workflow

**Do not edit code unless explicitly instructed.** By default, write implementation plans, instructions, and code snippets into the relevant ticket file in `Tickets/`. Only modify source files when the user specifically asks you to. Work on one ticket at a time — the current ticket is noted here. Completed tickets move to `Tickets/Done/`.

**Current ticket**: 12 (`Tickets/ToDo/12-bitterballen-index.md`)

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Development server with live reload (nodemon + livereload)
npm start          # Production server
```

The server runs on `http://localhost:3000`. Live reload uses port 35729 in dev mode.

There are no tests, linter, or build steps configured.

## Tech Stack

- **Backend**: Node.js, Express 5, CommonJS modules
- **Frontend**: Vanilla JavaScript, Bootstrap 5 (CDN), no build system
- **Database**: PostgreSQL (connection via `DATABASE_URL` in `.env`)
- **Dev tools**: nodemon, livereload, connect-livereload

## Architecture

```
server.js              # Express server, all API routes, livereload setup
db/database.js         # PostgreSQL pool + auto-creates tables on startup
public/js/app.js       # All frontend logic (fetches, renders, modals)
views/index.html       # Single HTML page (Bootstrap layout)
public/css/style.css   # Minimal custom styles (mostly footer)
Tickets/               # Feature tickets (kanban: ToDo/ and Done/)
```

This is a single-page app with no routing framework. The frontend fetches JSON from Express API endpoints and renders HTML dynamically.

### API Endpoints

- `GET /api/members` - All members
- `GET /api/driving` - Carpool members sorted by drive order
- `GET /api/payment` - Payment groups with balances
- `POST /api/sessions` - Record a session (updates balances, advances driver)
- `GET /api/sessions?filter=week|month|YYYY-MM` - Session history
- `DELETE /api/sessions/:id` - Delete session and reverse balance changes

### Database

Three tables (`members`, `sessions`, `session_attendance`) are auto-created in `db/database.js` on server startup. No migration system — schema changes go directly in the initialization code.

### Balance System (core business logic)

When a session is recorded: the payer gets `+N` balance (N = number of other attendees), each other attendee gets `-1`. The member with the **lowest balance** is suggested as the next payer. Payment groups (1: "DomoYomo", 2: "P.S.") are tracked independently.

### Driving Rotation

Only advances when payment group 1 records a session. The next driver in `drive_order` becomes `is_current_driver`, wrapping to the first member after the last.

## Windows Note

Never redirect to `NUL` in bash commands — use `/dev/null` instead. Redirecting to `NUL` creates an actual file on Windows that breaks git operations. See `.claude/SKILL.md` for the removal procedure if this happens.
