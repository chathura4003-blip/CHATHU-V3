require('dotenv').config({ path: require('path').join(__dirname, '.env') });
process.env.CHMD_ENV_PRELOADED = 'true';
process.env.CHMD_ENV_SOURCE = require('path').join(__dirname, '.env');

// ---------------------------------------------------------------------------
// Suppress benign Signal/Baileys decryption noise
// ---------------------------------------------------------------------------
// libsignal & Baileys log "Bad MAC", "MessageCounterError", "Failed to decrypt
// message with any known session..." straight to console.error / console.log.
// These errors are handled internally (Baileys retries automatically) but
// flood the dashboard log. Filter only the well-known harmless lines.
const NOISY_PATTERNS = [
    /Failed to decrypt message with any known session/i,
    /Session error:.*MessageCounterError/i,
    /Session error:.*Bad MAC/i,
    /MessageCounterError: Key used already or never filled/i,
    /Error: Bad MAC Error: Bad MAC/i,
    /at SessionCipher\./i,
    /at Object\.verifyMAC/i,
    /at _asyncQueueExecutor/i,
    /libsignal\/src\/(session_cipher|crypto|queue_job)\.js/i,
    /at process\.processTicksAndRejections/i,
    /Decrypted message with closed session/i,
    /Closing session: SessionEntry/i,
    /Closing open session in favor of incoming prekey bundle/i,
];
function isNoisySignalLine(args) {
    try {
        const text = args.map(a => (a instanceof Error ? `${a.message}\n${a.stack || ''}` : String(a))).join(' ');
        return NOISY_PATTERNS.some(re => re.test(text));
    } catch { return false; }
}
const _origConsoleError = console.error.bind(console);
const _origConsoleLog = console.log.bind(console);
const { logger } = require('./logger');

console.error = (...args) => { 
    if (isNoisySignalLine(args)) return; 
    _origConsoleError(...args);
    try { logger('[ERROR] ' + args.map(a => (a instanceof Error ? a.stack || a.message : String(a))).join(' ')); } catch {}
};
console.log = (...args) => { 
    if (isNoisySignalLine(args)) return; 
    _origConsoleLog(...args);
    try { logger(args.map(a => String(a)).join(' ')); } catch {}
};

// Final safety net: swallow well-known benign Signal/decryption noise so it
// doesn't spam the dashboard log, but for any other uncaught exception we log
// and *exit* — after an uncaughtException Node's internal state is undefined
// and it's unsafe to keep running (can corrupt db.json, leak FDs, etc.).
// A process manager (pm2 / Docker --restart / systemd) should restart us.
process.on('uncaughtException', (err) => {
    const msg = String(err?.message || err);
    if (NOISY_PATTERNS.some(re => re.test(msg))) return;
    _origConsoleError('[uncaughtException]', err);
    try { logger(`[FATAL] uncaughtException — exiting: ${err?.stack || err?.message || err}`); } catch {}
    // Give the logger a tick to flush before exiting.
    setTimeout(() => process.exit(1), 100).unref();
});
process.on('unhandledRejection', (reason) => {
    const msg = String(reason?.message || reason);
    if (NOISY_PATTERNS.some(re => re.test(msg))) return;
    _origConsoleError('[unhandledRejection]', reason);
    try { logger(`[WARN] unhandledRejection: ${reason?.stack || reason?.message || reason}`); } catch {}
});

const { startDashboard } = require('./dashboard');
const { startBot } = require('./bot');
const sessionManager = require('./session-manager');

async function main() {
    try {
        logger('Initializing dashboard and bots...');

        const cfg = require('./config');
        if (cfg.ADMIN_PASS === cfg.DEFAULT_ADMIN_PASS) {
            logger('[Security] WARNING: ADMIN_PASS is using the built-in default. Set ADMIN_PASS in .env (preferably a bcrypt hash via `npm run hash-pass -- "<pass>"`) before exposing the dashboard.');
        }
        if (cfg.JWT_SECRET === cfg.DEFAULT_JWT_SECRET) {
            logger('[Security] WARNING: JWT_SECRET is using the built-in default. Set JWT_SECRET in .env to a long random string before exposing the dashboard.');
        }

        // Start the web dashboard
        await startDashboard();
        
        // Start the main bot
        await startBot();
        
        // Restore any multi-sessions
        await sessionManager.autoRestore();
        
    } catch (error) {
        if (error?.code === 'EADDRINUSE') {
            logger(`Startup aborted: ${error.message}`);
        } else {
            logger(`Startup Error: ${error.message}`);
        }
        process.exitCode = 1;
    }
}

main();
