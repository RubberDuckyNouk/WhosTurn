const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// Live reload (development only)
const livereload = require("livereload");

const liveReloadServer = livereload.createServer();
liveReloadServer.watch([
    path.join(__dirname, "public"),
    path.join(__dirname, "views")
]);

liveReloadServer.server.once("connection", () => {
    setTimeout(() => {
        liveReloadServer.refresh("/");
    }, 100);
});

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, "public")));

// get html file
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "index.html"));
});

// Start the server
app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
