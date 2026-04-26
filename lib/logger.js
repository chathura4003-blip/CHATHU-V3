'use strict';

/*
 * Lightweight structured logger.
 *
 *   const log = require('./logger').child('handler');
 *   log.info('command dispatched', { name: 'menu', from });
 *   log.error('send failed', { err: e.message });
 *
 * Output format is controlled by the LOG_FORMAT env var:
 *   - 'json' (default): one JSON object per line, easy to ship to Loki/CloudWatch.
 *   - 'pretty': human-readable; useful for `npm start` during development.
 *
 * Levels honour the LOG_LEVEL env var (default: 'info').
 *   trace < debug < info < warn < error
 *
 * The logger is intentionally dependency-free so it can be used very early
 * in bootstrapping, before npm modules have been loaded.
 */

const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50 };
const LEVEL_COLOURS = {
  trace: '\x1b[90m', // grey
  debug: '\x1b[36m', // cyan
  info:  '\x1b[32m', // green
  warn:  '\x1b[33m', // yellow
  error: '\x1b[31m', // red
};
const RESET = '\x1b[0m';

function envLevel() {
  const raw = String(process.env.LOG_LEVEL || 'info').toLowerCase();
  return LEVELS[raw] || LEVELS.info;
}

const FORMAT = String(process.env.LOG_FORMAT || 'pretty').toLowerCase();
const isJson = FORMAT === 'json';
const isTty = !!process.stdout.isTTY;

function emit(level, scope, msg, fields) {
  if (LEVELS[level] < envLevel()) return;
  const ts = new Date().toISOString();
  if (isJson) {
    const record = { ts, level, scope, msg, ...fields };
    process.stdout.write(JSON.stringify(record) + '\n');
    return;
  }
  const colour = isTty ? LEVEL_COLOURS[level] : '';
  const reset = isTty ? RESET : '';
  const head = `${ts.slice(11, 23)} ${colour}${level.padEnd(5)}${reset}${scope ? ` [${scope}]` : ''}`;
  let tail = '';
  if (fields && Object.keys(fields).length) {
    try { tail = ' ' + JSON.stringify(fields); } catch { tail = ''; }
  }
  process.stdout.write(`${head} ${msg}${tail}\n`);
}

function makeLogger(scope) {
  const log = {};
  for (const lvl of Object.keys(LEVELS)) {
    log[lvl] = (msg, fields) => emit(lvl, scope, msg, fields);
  }
  log.child = (childScope) => makeLogger(scope ? `${scope}.${childScope}` : childScope);
  return log;
}

module.exports = makeLogger('');
module.exports.child = (scope) => makeLogger(scope);
module.exports.LEVELS = LEVELS;
