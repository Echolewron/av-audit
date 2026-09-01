const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');

const { PORT } = require('./src/config/config');
const { sanitizeMiddleware } = require('./src/middleware/sanitize');
const { setupSocketHandler } = require('./src/sockets/socketHandler');
const { startBackgroundJobs } = require('./src/utils/cron');

// Routes
const authRoutes = require('./src/routes/authRoutes');
const accountRoutes = require('./src/routes/accountRoutes');
const roleRoutes = require('./src/routes/roleRoutes');
const templateRoutes = require('./src/routes/templateRoutes');
const checklistRoutes = require('./src/routes/checklistRoutes');
const automationRoutes = require('./src/routes/automationRoutes');
const auditRoutes = require('./src/routes/auditRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const sermonRoutes = require('./src/routes/sermonRoutes');
const infoRoutes = require('./src/routes/infoRoutes');
const updateRoutes = require('./src/routes/updateRoutes');
const checklistService = require('./src/services/checklistService');
const dashboardAutomationService = require('./src/services/dashboardAutomationService');

const app = express();
app.set('trust proxy', true);
const server = http.createServer(app);

// Socket.io initialization
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true
  }
});
app.set('io', io);
setupSocketHandler(io);
dashboardAutomationService.init(io);

// Express Middleware
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use(sanitizeMiddleware);

// Universal State Ingestion Engine (/info/:key and /api/info/:key)
app.use('/info', infoRoutes);
app.use('/api/info', infoRoutes);

// Static files with immediate cache invalidation (HTML passes through dynamic prepareHtml)
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0,
  index: false,
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/dashboards', dashboardRoutes);
app.use('/api/sermons', sermonRoutes);
app.use('/api/system/update', updateRoutes);

const fs = require('fs');

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Public Dynamic Checklist Landing Route with Rich Open Graph Link Previews
app.get(['/checklist/:id', '/c/:id'], (req, res) => {
  const checklist = checklistService.getChecklistById(req.params.id);
  let protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  if (req.headers['cf-visitor']) {
    try {
      const cf = JSON.parse(req.headers['cf-visitor']);
      if (cf.scheme) protocol = cf.scheme;
    } catch (_) {}
  }
  const host = req.headers['x-forwarded-host'] || req.get('host') || `localhost:${PORT}`;
  if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
    protocol = 'https';
  }
  const fullBaseUrl = `${protocol}://${host}`;

  if (!checklist) {
    return res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Checklist Expired or Not Found — AV Audit</title>
  <link rel="stylesheet" href="/css/main.css">
  <link rel="stylesheet" href="/css/layout.css">
  <style>
    body { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #090d12; color: #f0f6fc; font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; }
    .not-found-card { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 2.5rem; max-width: 480px; text-align: center; box-shadow: 0 12px 40px rgba(0,0,0,0.6); margin: 1rem; }
    .brand-pill { display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #18edb3 0%, #0d8363 100%); color: #04100c; font-weight: 800; font-size: 1.3rem; margin-bottom: 1.25rem; }
    h1 { font-size: 1.35rem; margin-bottom: 0.75rem; color: #f0f6fc; }
    p { font-size: 0.875rem; color: #8b949e; margin-bottom: 1.75rem; line-height: 1.5; }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 0.65rem 1.25rem; background: #18edb3; color: #04100c; font-weight: 600; text-decoration: none; border-radius: 8px; transition: opacity 0.2s; }
    .btn:hover { opacity: 0.9; text-decoration: none; }
  </style>
</head>
<body>
  <div class="not-found-card">
    <div class="brand-pill">AV</div>
    <h1>Checklist Unavailable or Expired</h1>
    <p>This operational checklist may have been completed and purged under the retention policy, or it has been removed.</p>
    <a href="/" class="btn">Open AV Audit Console</a>
  </div>
</body>
</html>`);
  }

  const isSubmitted = checklist.status === 'SUBMITTED';
  const hasBlocked = Boolean(checklist.has_blocked && !isSubmitted);
  const statusText = isSubmitted ? 'Submitted' : (hasBlocked ? 'Blocked Items Reported' : 'In-Progress');
  const safeTitle = escapeHtml(checklist.title);
  const safeTmpl = escapeHtml(checklist.template_title || 'Custom');
  const previewImgUrl = `${fullBaseUrl}/api/checklists/${checklist.id}/preview.png?v=${checklist.progress}_${hasBlocked ? 'blocked' : 'ok'}_${isSubmitted ? 'submitted' : 'open'}`;
  const shareUrl = `${fullBaseUrl}/c/${checklist.id}`;

  const indexPath = path.join(__dirname, 'public', 'index.html');
  fs.readFile(indexPath, 'utf8', (err, html) => {
    if (err) {
      return res.status(500).send('Error loading application');
    }

    const ogTags = `<title>${safeTitle} — AV Audit</title>
  <meta name="description" content="${checklist.progress}% Completed • ${statusText}">
  <meta property="og:site_name" content="AV Audit Platform">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${checklist.progress}% Completed • ${statusText}">
  <meta property="og:image" content="${previewImgUrl}">
  <meta property="og:image:secure_url" content="${previewImgUrl}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${shareUrl}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${checklist.progress}% Completed • ${statusText}">
  <meta name="twitter:image" content="${previewImgUrl}">
  <meta name="theme-color" content="${hasBlocked ? '#f85149' : (isSubmitted ? '#58a6ff' : '#18edb3')}">
  <script>window.__INITIAL_CHECKLIST_ID__ = "${checklist.id}";</script>`;

    let injectedHtml = html.replace(
      /<title>[\s\S]*?<\/title>[\s\S]*?<meta\s+name="description"[\s\S]*?>/i,
      ogTags
    );

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(prepareHtml(injectedHtml));
  });
});

function getAppVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    return pkg.version || '1.0.0';
  } catch (_) {
    return '1.0.0';
  }
}

function prepareHtml(rawHtml) {
  const ver = getAppVersion();
  // Automatically bust asset cache with current package version
  return rawHtml
    .replace(/(href|src)="(\/[^"]+?\.(?:js|css))(?:\?[^"]*)?"/g, `$1="$2?v=${ver}"`);
}

// SPA Fallback with dynamic asset cache-busting
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'API endpoint not found' });
  }
  const indexPath = path.join(__dirname, 'public', 'index.html');
  fs.readFile(indexPath, 'utf8', (err, html) => {
    if (err) return res.status(500).send('Error loading application');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(prepareHtml(html));
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({
    error: 'SERVER_ERROR',
    message: err.message || 'An unexpected internal error occurred.'
  });
});

// Start Background Jobs
startBackgroundJobs();

// Listen
server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`  AV Audit Platform Online`);
  console.log(`  Listening on http://localhost:${PORT}`);
  console.log(`  Timezone Standard: America/Los_Angeles`);
  console.log(`=========================================`);
});

module.exports = { app, server };
