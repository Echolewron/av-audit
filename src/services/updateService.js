const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { db } = require('../db/database');

const updateService = {
  getRepoSlug() {
    let slug = '';
    if (process.env.GITHUB_REPO) {
      slug = process.env.GITHUB_REPO.trim();
    } else {
      try {
        const configPath = path.join(__dirname, '../../config.json');
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          if (config.githubRepo) slug = config.githubRepo.trim();
        }
      } catch (e) {
        // ignore
      }
    }
    if (!slug) slug = 'Echolewron/av-audit';

    // Strip https://github.com/, .git suffix, and leading/trailing slashes
    return slug
      .replace(/^https?:\/\/github\.com\//i, '')
      .replace(/\.git$/i, '')
      .replace(/^\/+|\/+$/g, '');
  },

  getCurrentVersion() {
    try {
      const pkgPath = path.join(__dirname, '../../package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return pkg.version || '0.1.0';
    } catch (e) {
      return '0.1.0';
    }
  },

  normalizeVersion(ver) {
    if (!ver) return '0.0.0';
    return String(ver).trim().replace(/^v/i, '').replace(/^beta\s*/i, '').trim();
  },

  compareVersions(v1, v2) {
    const norm1 = this.normalizeVersion(v1);
    const norm2 = this.normalizeVersion(v2);

    const parts1 = norm1.split('.').map(n => parseInt(n, 10) || 0);
    const parts2 = norm2.split('.').map(n => parseInt(n, 10) || 0);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  },

  async checkForUpdates() {
    const currentVersion = this.getCurrentVersion();
    const repoSlug = this.getRepoSlug();
    const headers = {
      'User-Agent': 'AV-Audit-OTA-Updater',
      'Accept': 'application/vnd.github.v3+json'
    };

    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${process.env.GITHUB_TOKEN.trim()}`;
    }

    let latestVersion = currentVersion;
    let releaseName = '';
    let changelog = '';
    let publishedAt = '';
    let releaseUrl = `https://github.com/${repoSlug}`;
    let updateAvailable = false;

    try {
      // 1. First try GitHub Releases API
      const releasesApiUrl = `https://api.github.com/repos/${repoSlug}/releases/latest`;
      const response = await fetch(releasesApiUrl, { headers });

      if (response.ok) {
        const data = await response.json();
        latestVersion = data.tag_name || data.name || currentVersion;
        releaseName = data.name || latestVersion;
        changelog = data.body || '';
        publishedAt = data.published_at || '';
        releaseUrl = data.html_url || releaseUrl;
        updateAvailable = this.compareVersions(latestVersion, currentVersion) > 0;
      } else if (response.status === 404) {
        // 2. Fallback: Query raw package.json on main branch if no releases are published yet
        const rawPkgUrl = `https://raw.githubusercontent.com/${repoSlug}/main/package.json`;
        const rawRes = await fetch(rawPkgUrl, { headers });
        if (rawRes.ok) {
          const remotePkg = await rawRes.json();
          latestVersion = remotePkg.version || currentVersion;
          releaseName = `Version ${latestVersion}`;
          updateAvailable = this.compareVersions(latestVersion, currentVersion) > 0;
          if (updateAvailable) {
            changelog = 'New commits and version updates available on main branch.';
          }
        }
      }
    } catch (err) {
      console.warn('[OTA Update] Failed to check remote GitHub version:', err.message);
    }

    return {
      currentVersion,
      latestVersion,
      updateAvailable,
      releaseName,
      changelog,
      publishedAt,
      releaseUrl,
      repoSlug
    };
  },

  async applyUpdate(io, actingUser, ipAddress) {
    const cwd = path.join(__dirname, '../../');

    return new Promise((resolve, reject) => {
      // 1. Broadcast updating status to all connected users
      if (io) {
        io.emit('system:updating', {
          message: 'Applying update and restarting AV Audit server...',
          startedAt: new Date().toISOString()
        });
      }

      // Log in audit trail
      try {
        db.audit.log({
          userId: actingUser?.id || 'system',
          username: actingUser?.username || 'Administrator',
          actionType: 'SYSTEM',
          actionName: 'OTA_UPDATE_INITIATED',
          details: { triggeredBy: actingUser?.username || 'admin' },
          ipAddress: ipAddress || '127.0.0.1'
        });
      } catch (e) {
        // ignore
      }

      console.log('[OTA Update] Pulling latest code from GitHub...');

      // 2. Run git pull and npm install
      exec('git pull origin main && npm install --omit=dev', { cwd, timeout: 60000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('[OTA Update] Update script failed:', error.message, stderr);
          return reject(new Error(`Update failed: ${error.message}`));
        }

        console.log('[OTA Update] Code updated successfully:\n', stdout);

        // Resolve response first so the HTTP client receives confirmation
        resolve({
          success: true,
          message: 'Update applied successfully. Server is restarting now...',
          output: stdout
        });

        // 3. Graceful restart: PM2 will automatically restart the process upon exit
        setTimeout(() => {
          console.log('[OTA Update] Restarting process via PM2...');
          process.exit(0);
        }, 1500);
      });
    });
  }
};

module.exports = updateService;
