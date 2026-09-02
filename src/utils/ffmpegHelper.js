const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawn, execFile } = require('child_process');

const BIN_DIR = path.resolve(__dirname, '../../bin');
const IS_WIN = process.platform === 'win32';
const FFMPEG_BIN_NAME = IS_WIN ? 'ffmpeg.exe' : 'ffmpeg';
const LOCAL_FFMPEG_PATH = path.join(BIN_DIR, FFMPEG_BIN_NAME);

// Concurrency mutex to prevent duplicate downloads
let activeDownloadPromise = null;

/**
 * Returns download URL and archive type based on current OS and architecture
 */
function getPlatformDownloadInfo() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'win32') {
    if (arch === 'x64') {
      return {
        url: 'https://github.com/vot/ffbinaries-prebuilt/releases/download/v4.4.1/ffmpeg-4.4.1-win-64.zip',
        type: 'zip'
      };
    }
    return {
      url: 'https://github.com/vot/ffbinaries-prebuilt/releases/download/v4.4.1/ffmpeg-4.4.1-win-32.zip',
      type: 'zip'
    };
  }

  if (platform === 'linux') {
    if (arch === 'arm64') {
      return {
        url: 'https://github.com/vot/ffbinaries-prebuilt/releases/download/v4.4.1/ffmpeg-4.4.1-linux-arm-64.tar.gz',
        type: 'tar.gz'
      };
    }
    if (arch === 'arm') {
      return {
        url: 'https://github.com/vot/ffbinaries-prebuilt/releases/download/v4.4.1/ffmpeg-4.4.1-linux-arm-32.tar.gz',
        type: 'tar.gz'
      };
    }
    return {
      url: 'https://github.com/vot/ffbinaries-prebuilt/releases/download/v4.4.1/ffmpeg-4.4.1-linux-64.tar.gz',
      type: 'tar.gz'
    };
  }

  if (platform === 'darwin') {
    return {
      url: 'https://github.com/vot/ffbinaries-prebuilt/releases/download/v4.4.1/ffmpeg-4.4.1-osx-64.zip',
      type: 'zip'
    };
  }

  // Fallback default
  return {
    url: 'https://github.com/vot/ffbinaries-prebuilt/releases/download/v4.4.1/ffmpeg-4.4.1-linux-64.tar.gz',
    type: 'tar.gz'
  };
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
          'User-Agent': 'AV-Audit-FFmpeg-Downloader'
        }
      }, (res) => {
        // Handle HTTP redirects (301, 302, 303, 307, 308)
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          const newUrl = new URL(res.headers.location, currentUrl).href;
          return makeRequest(newUrl, redirectCount + 1);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`Failed to download FFmpeg: HTTP ${res.statusCode} ${res.statusMessage}`));
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
function extractArchive(archivePath, archiveType) {
  return new Promise((resolve, reject) => {
    if (archiveType === 'zip') {
      if (IS_WIN) {
        // Try built-in tar first on Windows 10/11
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
          // PowerShell fallback if tar is not present
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
        // Unix unzip
        const proc = spawn('unzip', ['-o', archivePath, '-d', BIN_DIR], { stdio: 'ignore' });
        proc.on('close', (code) => {
          if (code === 0) return resolve();
          // Fallback to tar
          const tarProc = spawn('tar', ['-xf', archivePath, '-C', BIN_DIR], { stdio: 'ignore' });
          tarProc.on('close', (tarCode) => {
            if (tarCode === 0) return resolve();
            reject(new Error(`Failed to extract FFmpeg zip archive (code ${code}/${tarCode})`));
          });
          tarProc.on('error', (err) => reject(new Error(`Extraction error: ${err.message}`)));
        });
        proc.on('error', () => {
          const tarProc = spawn('tar', ['-xf', archivePath, '-C', BIN_DIR], { stdio: 'ignore' });
          tarProc.on('close', (tarCode) => {
            if (tarCode === 0) return resolve();
            reject(new Error('Failed to extract FFmpeg zip archive.'));
          });
          tarProc.on('error', (err) => reject(new Error(`Extraction error: ${err.message}`)));
        });
      }
    } else {
      // tar.gz
      const proc = spawn('tar', ['-xzf', archivePath, '-C', BIN_DIR], { stdio: 'ignore' });
      proc.on('close', (code) => {
        if (code === 0) return resolve();
        reject(new Error(`Failed to extract FFmpeg tar.gz archive (exit code ${code})`));
      });
      proc.on('error', (err) => reject(new Error(`tar extraction failed: ${err.message}`)));
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

      const downloadInfo = getPlatformDownloadInfo();
      const tempArchive = path.join(BIN_DIR, `ffmpeg_download_${Date.now()}.${downloadInfo.type === 'zip' ? 'zip' : 'tar.gz'}`);

      onProgress({ message: 'FFmpeg not detected. Downloading portable FFmpeg to bin/ (~20MB)...', percent: 0 });

      // Download archive
      await downloadFileWithRedirect(downloadInfo.url, tempArchive, onProgress);

      onProgress({ message: 'Extracting FFmpeg to bin/...', percent: 95 });

      // Extract archive into bin/
      await extractArchive(tempArchive, downloadInfo.type);

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
