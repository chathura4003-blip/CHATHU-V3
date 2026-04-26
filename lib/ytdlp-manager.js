"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const YTDlpWrap = require("yt-dlp-wrap").default;
const ffmpegStatic = require("ffmpeg-static");
const fluentFfmpeg = require("fluent-ffmpeg");
const { logger } = require("../logger");

const isWin = process.platform === "win32";
const isMac = process.platform === "darwin";
const BIN_NAME = isWin ? "yt-dlp.exe" : "yt-dlp";
let BIN_PATH = path.join(__dirname, "..", BIN_NAME);

// On Linux (Railway), check system path first
if (!isWin && !fs.existsSync(BIN_PATH) && fs.existsSync("/usr/local/bin/yt-dlp")) {
  BIN_PATH = "/usr/local/bin/yt-dlp";
}

// Pick the standalone (PyInstaller) build for the current platform/arch so the
// runtime does NOT depend on a system python3 install.
function _standaloneAssetName() {
  if (isWin) return "yt-dlp.exe";
  if (isMac) return "yt-dlp_macos";
  const arch = process.arch;
  if (arch === "arm64" || arch === "aarch64") return "yt-dlp_linux_aarch64";
  if (arch === "arm" || arch === "armv7l") return "yt-dlp_linux_armv7l";
  return "yt-dlp_linux"; // x64 / generic
}

// Detect whether `binPath` is the python-zip build (needs python3) versus
// the self-contained PyInstaller binary. The python-zip starts with a shebang
// (e.g. `#!/usr/bin/env python3`) while the standalone build is an ELF/Mach-O.
function _isPythonScriptBinary(binPath) {
  try {
    const fd = fs.openSync(binPath, "r");
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    if (buf[0] === 0x23 && buf[1] === 0x21) return true; // "#!" shebang -> needs python
    return false;
  } catch {
    return false;
  }
}

function _hasPython3() {
  try {
    execSync("python3 --version", { stdio: "pipe", timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

function setBinPath(nextPath) {
  if (!nextPath || nextPath === BIN_PATH) return BIN_PATH;
  BIN_PATH = nextPath;
  if (_ytdlp?.setBinaryPath) {
    _ytdlp.setBinaryPath(BIN_PATH);
  } else {
    _ytdlp = null;
  }
  return BIN_PATH;
}

function resolveExistingBinary() {
  const os = require("os");
  const candidates = [
    BIN_PATH,
    path.join(process.cwd(), BIN_NAME),
    path.join(__dirname, "..", BIN_NAME),
    path.join(os.homedir(), "yt-dlp", BIN_NAME),
    path.join(os.homedir(), ".local", "bin", BIN_NAME),
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return setBinPath(candidate);
    }
  }

  try {
    const found = execSync(isWin ? "where yt-dlp" : "which yt-dlp", {
      stdio: "pipe",
      timeout: 3000,
    })
      .toString()
      .trim()
      .split(/\r?\n/)[0]
      .trim();
    if (found && fs.existsSync(found)) {
      return setBinPath(found);
    }
  } catch {}

  return BIN_PATH;
}

let FFMPEG_PATH = null;
(function detectFfmpeg() {
  try {
    const found = execSync(isWin ? "where ffmpeg" : "which ffmpeg", {
      stdio: "pipe",
      timeout: 3000,
    })
      .toString()
      .trim()
      .split("\n")[0]
      .trim();
    if (found && fs.existsSync(found)) {
      FFMPEG_PATH = found;
      return;
    }
  } catch {}

  const candidates = isWin
    ? []
    : [
        "/usr/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/nix/store/6h39ipxhzp4r5in5g4rhdjz7p7fkicd0-replit-runtime-path/bin/ffmpeg",
      ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      FFMPEG_PATH = c;
      return;
    }
  }

  if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
    FFMPEG_PATH = ffmpegStatic;
  }
})();

if (FFMPEG_PATH) {
  fluentFfmpeg.setFfmpegPath(FFMPEG_PATH);
  logger(`[ffmpeg] Using: ${FFMPEG_PATH}`);
} else {
  logger("[ffmpeg] WARNING: ffmpeg not found — video compression disabled");
}

// Ensure python3 is available — only required for the python-zip build of
// yt-dlp. The standalone PyInstaller binary does NOT need this.
function _ensurePython3() {
  if (_hasPython3()) return true;
  // Try python as fallback (some distros only ship `python`)
  try {
    execSync("python --version", { stdio: "pipe", timeout: 3000 });
    const os = require("os");
    const localBin = path.join(os.homedir(), ".local", "bin");
    if (!fs.existsSync(localBin)) fs.mkdirSync(localBin, { recursive: true });
    const symlink = path.join(localBin, "python3");
    if (!fs.existsSync(symlink)) {
      const pythonPath = execSync("which python", { stdio: "pipe" })
        .toString()
        .trim();
      fs.symlinkSync(pythonPath, symlink);
      logger(
        "[yt-dlp] Created python3 -> python symlink for yt-dlp compatibility"
      );
      return true;
    }
  } catch {}
  return false;
}

function _downloadStandalone(downloadPath) {
  const asset = _standaloneAssetName();
  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;
  // curl is preferred (handles redirects); fall back to wget.
  execSync(
    `curl -fL "${url}" -o "${downloadPath}" || wget -q "${url}" -O "${downloadPath}"`,
    { stdio: "pipe", timeout: 180000, shell: "/bin/bash" }
  );
  if (!fs.existsSync(downloadPath)) {
    throw new Error("download produced no file");
  }
  if (!isWin) execSync(`chmod +x "${downloadPath}"`, { stdio: "pipe" });
  return downloadPath;
}

async function ensureYtdlp() {
  resolveExistingBinary();

  if (fs.existsSync(BIN_PATH)) {
    // If we ended up with the python-zip variant on a host without python3,
    // overwrite it with the standalone (PyInstaller) build so downloads work.
    if (!isWin && _isPythonScriptBinary(BIN_PATH) && !_ensurePython3()) {
      logger(
        "[yt-dlp] Existing binary is the python-zip build but python3 is unavailable — replacing with standalone build"
      );
      try {
        _downloadStandalone(BIN_PATH);
        logger(`[yt-dlp] Replaced with standalone binary at: ${BIN_PATH}`);
        _ytdlp = null;
        return true;
      } catch (err) {
        logger(`[yt-dlp] Standalone replacement failed: ${err.message}`);
        return false;
      }
    }
    logger(`[yt-dlp] Binary ready at: ${BIN_PATH}`);
    return true;
  }

  if (isWin) {
    logger("[yt-dlp] Binary missing — downloading...");
    try {
      const url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
      execSync(`powershell -Command "Invoke-WebRequest -Uri '${url}' -OutFile '${BIN_PATH}'"`, { stdio: "pipe", timeout: 120000 });
      logger("[yt-dlp] Downloaded successfully");
      // On Windows, copy the binary to a path without spaces to avoid spawn issues
      try {
        const os = require("os");
        const altDir = path.join(os.homedir(), "yt-dlp");
        if (!fs.existsSync(altDir)) fs.mkdirSync(altDir, { recursive: true });
        const altPath = path.join(altDir, BIN_NAME);
        fs.copyFileSync(BIN_PATH, altPath);
        // prefer the alternate path if copy succeeded
        if (fs.existsSync(altPath)) {
          setBinPath(altPath);
          logger(`[yt-dlp] Copied binary to safe path: ${BIN_PATH}`);
        }
      } catch (copyErr) {
        logger(`[yt-dlp] Could not copy binary to alternate path: ${copyErr.message}`);
      }
      return true;
    } catch (err) {
      logger(`[yt-dlp] Download failed: ${err.message}`);
      return false;
    }
  }
  
  // Linux/macOS: Try to find yt-dlp in system PATH
  try {
    const found = execSync("which yt-dlp", { stdio: "pipe", timeout: 3000 })
      .toString()
      .trim();
    if (found && fs.existsSync(found)) {
      setBinPath(found);
      logger(`[yt-dlp] Found system binary at: ${BIN_PATH}`);
      return true;
    }
  } catch {}
  
  // Linux/macOS: download the platform-specific standalone (PyInstaller) build
  // — this avoids the runtime python3 dependency that the plain `yt-dlp`
  // python-zip release has.
  logger(
    `[yt-dlp] Binary missing — downloading standalone build (${_standaloneAssetName()}) to ~/.local/bin...`
  );
  try {
    const os = require("os");
    const localBinDir = path.join(os.homedir(), ".local", "bin");
    const downloadPath = path.join(localBinDir, BIN_NAME);

    if (!fs.existsSync(localBinDir)) {
      fs.mkdirSync(localBinDir, { recursive: true });
    }

    _downloadStandalone(downloadPath);
    setBinPath(downloadPath);
    logger(`[yt-dlp] Downloaded to: ${BIN_PATH}`);
    return true;
  } catch (err) {
    logger(`[yt-dlp] Download attempt failed: ${err.message}`);
  }
  
  // Last resort: try pip install
  logger("[yt-dlp] Attempting pip install as fallback...");
  try {
    execSync("pip install -q yt-dlp 2>/dev/null", { stdio: "pipe", timeout: 60000 });
    const found = execSync("which yt-dlp", { stdio: "pipe", timeout: 3000 })
      .toString()
      .trim();
    if (found && fs.existsSync(found)) {
      setBinPath(found);
      logger(`[yt-dlp] Installed via pip at: ${BIN_PATH}`);
      return true;
    }
  } catch {}
  
  logger("[yt-dlp] ERROR: Could not obtain yt-dlp binary. Install with: pip install yt-dlp or apt install yt-dlp");
  return false;
}

let _ytdlp = null;
function getYtdlp() {
  resolveExistingBinary();
  if (!_ytdlp) _ytdlp = new YTDlpWrap(BIN_PATH);
  return _ytdlp;
}

function getBinPath() {
  return resolveExistingBinary();
}

module.exports = { ensureYtdlp, getYtdlp, getBinPath, FFMPEG_PATH, fluentFfmpeg };
