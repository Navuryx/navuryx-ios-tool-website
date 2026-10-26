const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// In-memory active PC sessions
// token -> { token, lanIp, port, apps, pendingRequests: [], lastSeen: Date }
const sessions = new Map();

// Built-in Navuryx App Suite Catalog
const BUILTIN_APPS = [
  {
    id: "com.navuryx.container",
    name: "Navuryx Live Container",
    version: "1.0.0",
    developer: "Navuryx Team",
    description: "Bypass Apple's 3-app personal provisioning limit. 1 slot hosts unlimited guest apps in isolated sandboxes.",
    category: "System Utility",
    icon: "https://raw.githubusercontent.com/Navuryx/navuryx-appstore-apps/main/ios-container/Assets/AppIcon.png",
    downloadUrl: "https://github.com/Navuryx/navuryx-appstore-apps/releases/latest/download/NavuryxContainer.ipa",
    size: 130730,
    source: "container"
  },
  {
    id: "com.navuryx.browser",
    name: "Navuryx Tor Browser",
    version: "1.2.0",
    developer: "Navuryx Team",
    description: "Privacy-first web browser with native Tor onion routing, multi-tab support, and isolated browsing.",
    category: "Browsers",
    icon: "https://raw.githubusercontent.com/Navuryx/navuryx-appstore-apps/main/ios-browser/Assets/AppIcon.png",
    downloadUrl: "https://github.com/Navuryx/navuryx-appstore-apps/releases/latest/download/NavuryxBrowser.ipa",
    size: 2981833,
    source: "browser"
  },
  {
    id: "com.navuryx.chat",
    name: "Navuryx Chat",
    version: "1.0.0",
    developer: "Navuryx Team",
    description: "End-to-end encrypted direct peer messaging for iOS.",
    category: "Communication",
    icon: "",
    downloadUrl: "https://github.com/Navuryx/navuryx-appstore-apps/releases/latest/download/NavuryxChat.ipa",
    size: 97852,
    source: "chat"
  },
  {
    id: "com.navuryx.games.2048",
    name: "Navuryx 2048",
    version: "1.0.0",
    developer: "Navuryx Team",
    description: "Minimalist sliding tile puzzle game with zero ads.",
    category: "Games",
    icon: "",
    downloadUrl: "https://github.com/Navuryx/navuryx-appstore-apps/releases/latest/download/Navuryx2048.ipa",
    size: 62603,
    source: "g2048"
  },
  {
    id: "com.navuryx.games.snake",
    name: "Navuryx Snake",
    version: "1.0.0",
    developer: "Navuryx Team",
    description: "Retro arcade snake with classic grid physics.",
    category: "Games",
    icon: "",
    downloadUrl: "https://github.com/Navuryx/navuryx-appstore-apps/releases/latest/download/NavuryxSnake.ipa",
    size: 62678,
    source: "snake"
  },
  {
    id: "com.navuryx.games.pong",
    name: "Navuryx Pong",
    version: "1.0.0",
    developer: "Navuryx Team",
    description: "High frame-rate responsive retro table tennis game.",
    category: "Games",
    icon: "",
    downloadUrl: "https://github.com/Navuryx/navuryx-appstore-apps/releases/latest/download/NavuryxPong.ipa",
    size: 54719,
    source: "pong"
  }
];

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Navuryx PC Connect Bridge', sessionsActive: sessions.size });
});

// PC Registration & Heartbeat
// PC sends { token, lanIp, storePort, apps, deviceUdid }
app.post(['/api/session/register', '/api/pc/sync'], (req, res) => {
  const { token, lanIp, storePort, apps, machine } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Missing session token' });
  }

  const existing = sessions.get(token) || { pendingRequests: [] };
  const updatedSession = {
    token,
    lanIp: lanIp || req.ip,
    storePort: storePort || 8080,
    apps: Array.isArray(apps) ? apps : [],
    machine: machine || 'Navuryx PC',
    pendingRequests: existing.pendingRequests,
    lastSeen: Date.now()
  };

  sessions.set(token, updatedSession);
  res.json({
    status: 'connected',
    token,
    pendingCount: updatedSession.pendingRequests.length,
    portalUrl: `https://${req.headers.host || 'navuryx-ios-tool.vercel.app'}/?pair=${token}`
  });
});

// Phone queries PC session state
app.get(['/api/state', '/state'], (req, res) => {
  const token = req.query.k || req.query.pair || req.query.token;
  if (!token) {
    return res.json({
      connected: false,
      message: 'No PC paired yet. Enter your PC pair code or scan the QR code in Navuryx iOS Tool.',
      availableBuiltins: BUILTIN_APPS,
      apps: []
    });
  }

  const session = sessions.get(token);
  if (!session) {
    return res.json({
      connected: false,
      token,
      message: 'PC session expired or offline. Start the Phone Store in Navuryx iOS Tool to reconnect.',
      availableBuiltins: BUILTIN_APPS,
      apps: []
    });
  }

  res.json({
    connected: true,
    token,
    lanIp: session.lanIp,
    machine: session.machine,
    lastSeen: session.lastSeen,
    apps: session.apps.length > 0 ? session.apps : BUILTIN_APPS,
    availableBuiltins: BUILTIN_APPS,
    pending: session.pendingRequests.map(p => p.app)
  });
});

// Phone requests an app to be signed by PC
app.all(['/api/request', '/request'], (req, res) => {
  const token = req.query.k || req.query.pair || req.body.token || req.body.k;
  const appName = req.query.app || req.body.app;

  if (!appName) {
    return res.status(400).send('Missing app name');
  }

  const session = token ? sessions.get(token) : null;
  if (session) {
    session.pendingRequests.push({ app: appName, timestamp: Date.now() });
    return res.send(`App ${appName} queued for signing on your PC.`);
  }

  // If no PC connected yet, acknowledge queue
  res.send(`Queued ${appName}. Start Navuryx iOS Tool on PC to sign.`);
});

// PC pulls pending requests
app.get('/api/queue', (req, res) => {
  const token = req.query.k || req.query.token;
  if (!token || !sessions.has(token)) {
    return res.json({ pending: [] });
  }

  const session = sessions.get(token);
  session.lastSeen = Date.now();
  const queue = [...session.pendingRequests];
  session.pendingRequests = []; // Drain queue
  res.json({ pending: queue });
});

// AltStore / Navuryx Store Source JSON
app.get(['/source.json', '/api/source.json'], (req, res) => {
  const token = req.query.k || req.query.token || "";
  const host = req.headers.host || 'navuryx-ios-tool.vercel.app';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const base = `${proto}://${host}`;

  const session = token ? sessions.get(token) : null;
  const appList = (session && session.apps.length > 0) ? session.apps : BUILTIN_APPS;

  const altStorePayload = {
    name: "Navuryx Store",
    identifier: "com.navuryx.store",
    subtitle: "Sideloading without limits, Mac-free signing & Live Container",
    website: base,
    apps: appList.map((app, idx) => ({
      name: app.name || app.title,
      bundleIdentifier: app.id || app.bundle_id || `com.navuryx.app.${idx}`,
      developerName: app.developer || "Navuryx",
      version: app.version || "1.0",
      versionDate: new Date().toISOString(),
      versionDescription: "Navuryx official release",
      downloadURL: app.downloadUrl || `${base}/ipa/${idx}.ipa?k=${token}`,
      localizedDescription: app.description || "Navuryx bundled application",
      iconURL: app.icon || "",
      tintColor: "#4169E1",
      size: app.size || 1000000
    }))
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(altStorePayload);
});

// Apple OTA Manifest (itms-services) Generator
app.get(['/manifest/:id.plist', '/api/manifest/:id.plist'], (req, res) => {
  const idStr = req.params.id;
  const idx = parseInt(idStr, 10);
  const token = req.query.k || req.query.token || "";
  const host = req.headers.host || 'navuryx-ios-tool.vercel.app';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const base = `${proto}://${host}`;

  const session = token ? sessions.get(token) : null;
  let targetApp = null;

  if (session && session.apps[idx]) {
    targetApp = session.apps[idx];
  } else if (!isNaN(idx) && BUILTIN_APPS[idx]) {
    targetApp = BUILTIN_APPS[idx];
  } else {
    targetApp = BUILTIN_APPS[0];
  }

  const appName = targetApp.name || targetApp.title || "Navuryx App";
  const bundleId = targetApp.id || targetApp.bundle_id || "com.navuryx.app";
  const version = targetApp.version || "1.0";
  const ipaUrl = targetApp.downloadUrl || `${base}/ipa/${idx}.ipa?k=${token}`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key>
          <string>software-package</string>
          <key>url</key>
          <string>${ipaUrl.replace(/&/g, '&amp;')}</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>${bundleId}</string>
        <key>bundle-version</key>
        <string>${version}</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>${appName}</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>`;

  res.setHeader('Content-Type', 'text/xml');
  res.send(xml);
});

// Serve frontend static root
app.use(express.static(path.join(__dirname, '..')));

// Fallback to index.html for UI routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

module.exports = app;
