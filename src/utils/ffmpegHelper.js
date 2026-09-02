const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');

const BIN_DIR = path.resolve(__dirname, '../../bin');
const IS_WIN = process.platform === 'win32';
const FFMPEG_BIN_NAME = IS_WIN ? 'ffmpeg.exe' : 'ffmpeg';
const LOCAL_FFMPEG_PATH = path.join(BIN_DIR, FFMPEG_BIN_NAME);

// Concurrency mutex to prevent duplicate downloads
let activeDownloadPromise = null;

// Primary & fallback candidate URLs per platform
const PLATFORM_CANDIDATES = {
  'windows-64': [
    'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-win-64.zip'
  ],
  'linux-64': [
    'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-linux-64.zip'
  ],
  'linux-arm-64': [
    'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-linux-arm-64.zip'
  ],
  'linux-armhf-32': [
    'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-linux-armhf-32.zip'
  ],
  'osx-64': [
    'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-macos-64.zip'
  ]
};

/**
 * Returns platform key for current OS and architecture
 */
function getPlatformKey() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'win32') return 'windows-64';
  if (platform === 'darwin') return 'osx-64';
  if (platform === 'linux') {
    if (arch === 'arm64') return 'linux-arm-64';
    if (arch === 'arm') return 'linux-armhf-32';
    return 'linux-64';
  }
  return 'linux-64';
}

/**
 * Test if a given binary path is functional
 */
function testBinary(binPath) {
  return new Promise((resolve) => {
    try {
      const proc = spawn(binPath, ['-version'], { stdio: 'ignore' });
      proc.on('error', () => resolve(false));
      proc.on('close', (code) => resolve(code === 0));
    } catch (_) {
      resolve(false);
    }
  });
}

/**
 * Check if FFmpeg exists locally in bin/ or in system PATH
 * Returns absolute path to local binary, 'ffmpeg' if in system PATH, or null if missing.
 */
async function getFFmpegPath() {
  // 1. Check local bin/ folder first
  if (fs.existsSync(LOCAL_FFMPEG_PATH)) {
    const isWorking = await testBinary(LOCAL_FFMPEG_PATH);
    if (isWorking) return LOCAL_FFMPEG_PATH;
  }

  // 2. Check system PATH
  const systemWorking = await testBinary('ffmpeg');
  if (systemWorking) return 'ffmpeg';

  return null;
}

/**
 * Download a file following HTTP/HTTPS redirects with progress callback
 */
function downloadFileWithRedirect(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const makeRequest = (currentUrl, redirectCount = 0) => {
      if (redirectCount > 10) {
        return reject(new Error('Too many redirects while downloading FFmpeg.'));
      }

      const client = currentUrl.startsWith('https') ? https : http;
      const req = client.get(currentUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AV-Audit/1.0',
          'Accept': '*/*'
        }
      }, (res) => {
        // Handle HTTP redirects (301, 302, 303, 307, 308)
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          const newUrl = new URL(res.headers.location, currentUrl).href;
          return makeRequest(newUrl, redirectCount + 1);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} ${res.statusMessage || 'Not Found'}`));
        }

        const totalBytes = parseInt(res.headers['content-length'], 10) || 0;
        let downloadedBytes = 0;
        let lastReportedPct = -1;

        const fileStream = fs.createWriteStream(destPath);

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0 && typeof onProgress === 'function') {
            const pct = Math.floor((downloadedBytes / totalBytes) * 100);
            if (pct !== lastReportedPct && pct % 5 === 0) {
              lastReportedPct = pct;
              const downloadedMB = (downloadedBytes / (1024 * 1024)).toFixed(1);
              const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);
              onProgress({
                percent: pct,
                message: `Downloading FFmpeg (${pct}% - ${downloadedMB}MB / ${totalMB}MB)...`
              });
            }
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => resolve(destPath));
        });

        fileStream.on('error', (err) => {
          try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (_) {}
          reject(err);
        });
      });

      req.on('error', (err) => {
        try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (_) {}
        reject(err);
      });
    };

    makeRequest(url);
  });
}

/**
 * Extract downloaded archive into bin/
 */
function extractArchive(archivePath) {
  return new Promise((resolve, reject) => {
    if (IS_WIN) {
      // Try built-in tar on Windows 10/11
      const tarProc = spawn('tar', ['-xf', archivePath, '-C', BIN_DIR], { stdio: 'ignore' });
      tarProc.on('close', (code) => {
        if (code === 0 && fs.existsSync(LOCAL_FFMPEG_PATH)) {
          return resolve();
        }
        // Fallback to PowerShell Expand-Archive
        const psCommand = `Expand-Archive -LiteralPath "${archivePath}" -DestinationPath "${BIN_DIR}" -Force`;
        const psProc = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', psCommand], { stdio: 'ignore' });
        psProc.on('close', (psCode) => {
          if (psCode === 0 && fs.existsSync(LOCAL_FFMPEG_PATH)) {
            return resolve();
          }
          reject(new Error(`Failed to extract FFmpeg zip archive (PowerShell code ${psCode})`));
        });
        psProc.on('error', (err) => reject(new Error(`Extraction error: ${err.message}`)));
      });
      tarProc.on('error', () => {
        const psCommand = `Expand-Archive -LiteralPath "${archivePath}" -DestinationPath "${BIN_DIR}" -Force`;
        const psProc = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', psCommand], { stdio: 'ignore' });
        psProc.on('close', (psCode) => {
          if (psCode === 0 && fs.existsSync(LOCAL_FFMPEG_PATH)) {
            return resolve();
          }
          reject(new Error(`Failed to extract FFmpeg zip archive (PowerShell code ${psCode})`));
        });
        psProc.on('error', (err) => reject(new Error(`Extraction error: ${err.message}`)));
      });
    } else {
      // Unix: try unzip then tar
      const proc = spawn('unzip', ['-o', archivePath, '-d', BIN_DIR], { stdio: 'ignore' });
      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(LOCAL_FFMPEG_PATH)) return resolve();
        const tarProc = spawn('tar', ['-xf', archivePath, '-C', BIN_DIR], { stdio: 'ignore' });
        tarProc.on('close', (tarCode) => {
          if (tarCode === 0 && fs.existsSync(LOCAL_FFMPEG_PATH)) return resolve();
          reject(new Error(`Failed to extract FFmpeg archive (unzip code ${code}, tar code ${tarCode})`));
        });
        tarProc.on('error', (err) => reject(new Error(`Extraction error: ${err.message}`)));
      });
      proc.on('error', () => {
        const tarProc = spawn('tar', ['-xf', archivePath, '-C', BIN_DIR], { stdio: 'ignore' });
        tarProc.on('close', (tarCode) => {
          if (tarCode === 0 && fs.existsSync(LOCAL_FFMPEG_PATH)) return resolve();
          reject(new Error('Failed to extract FFmpeg zip archive.'));
        });
        tarProc.on('error', (err) => reject(new Error(`Extraction error: ${err.message}`)));
      });
    }
  });
}

/**
 * Ensures FFmpeg is available. If missing, downloads it into the project bin/ folder.
 * @param {Function} onProgress - Optional callback for status messages: (info: { message: string, percent?: number }) => void
 * @returns {Promise<string>} Path to the FFmpeg executable
 */
async function ensureFFmpeg(onProgress = () => {}) {
  // Check if FFmpeg is already available
  const existingPath = await getFFmpegPath();
  if (existingPath) {
    return existingPath;
  }

  // If a download is already in progress, await it
  if (activeDownloadPromise) {
    return activeDownloadPromise;
  }

  activeDownloadPromise = (async () => {
    try {
      if (!fs.existsSync(BIN_DIR)) {
        fs.mkdirSync(BIN_DIR, { recursive: true });
      }

      const platformKey = getPlatformKey();
      const candidates = PLATFORM_CANDIDATES[platformKey] || PLATFORM_CANDIDATES['linux-64'];
      const tempArchive = path.join(BIN_DIR, `ffmpeg_download_${Date.now()}.zip`);

      let downloadSuccess = false;
      let lastError = null;

      onProgress({ message: 'FFmpeg not detected. Downloading portable FFmpeg to bin/ (~25MB)...', percent: 0 });

      for (const downloadUrl of candidates) {
        try {
          await downloadFileWithRedirect(downloadUrl, tempArchive, onProgress);
          downloadSuccess = true;
          break;
        } catch (err) {
          lastError = err;
          console.warn(`Download candidate failed (${downloadUrl}):`, err.message);
        }
      }

      if (!downloadSuccess) {
        throw new Error(`Failed to download FFmpeg: ${lastError ? lastError.message : 'All download sources failed.'}`);
      }

      onProgress({ message: 'Extracting FFmpeg to bin/...', percent: 95 });

      // Extract archive into bin/
      await extractArchive(tempArchive);

      // Clean up temporary archive
      try {
        if (fs.existsSync(tempArchive)) {
          fs.unlinkSync(tempArchive);
        }
      } catch (_) {}

      // Set execute permissions on Unix
      if (!IS_WIN && fs.existsSync(LOCAL_FFMPEG_PATH)) {
        try {
          fs.chmodSync(LOCAL_FFMPEG_PATH, 0o755);
        } catch (_) {}
      }

      // Verify newly installed binary
      const works = await testBinary(LOCAL_FFMPEG_PATH);
      if (!works) {
        throw new Error(`FFmpeg was downloaded to ${LOCAL_FFMPEG_PATH} but failed verification test.`);
      }

      onProgress({ message: 'FFmpeg installed successfully in bin/. Starting compression...', percent: 100 });
      return LOCAL_FFMPEG_PATH;
    } finally {
      activeDownloadPromise = null;
    }
  })();

  return activeDownloadPromise;
}

module.exports = {
  BIN_DIR,
  LOCAL_FFMPEG_PATH,
  getFFmpegPath,
  ensureFFmpeg
};
