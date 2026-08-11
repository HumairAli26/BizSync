const { app, BrowserWindow } = require("electron");
const express = require("express");
const path = require("path");

let server;

function startServer() {
  const web = express();

  // In development (__dirname = electron/)
  // In production (__dirname = app.asar)
  const distPath = path.join(__dirname, "dist");

  // Serve the exported Expo app
  web.use(express.static(distPath));

  // Fallback for Expo Router
  web.get(/.*/, (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  server = web.listen(3000, () => {
    console.log("Local server running at http://localhost:3000");
    createWindow();
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "builds", "favicon.ico"),
  });

  win.loadURL("http://localhost:3000");

  // Uncomment while debugging
  // win.webContents.openDevTools();
}

app.whenReady().then(startServer);

app.on("window-all-closed", () => {
  if (server) {
    server.close();
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});
