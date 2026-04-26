'use strict';

/*
 * Wraps `sock.sendMessage` with a small retry policy and metrics.
 * Use it instead of calling sock.sendMessage directly when reliability matters
 * (broadcast, scheduler, command replies). Imported lazily so unit-tests of the
 * helpers don't have to construct a Baileys socket.
 */

const log = require('./logger').child('safe-send');
const metrics = require('./metrics');

const sendsTotal = metrics.counter('chathu_messages_sent_total', null, 'Outgoing messages successfully sent');
const sendFailures = metrics.counter('chathu_messages_send_failures_total', null, 'Outgoing messages that failed after all retries');
const sendRetries = metrics.counter('chathu_messages_send_retries_total', null, 'Send retries attempted');

const DEFAULT_RETRIES = 2;
const BACKOFF_MS = 600;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {Object} sock     Baileys socket (must expose sendMessage).
 * @param {string} jid      Target JID.
 * @param {Object} content  Message content.
 * @param {Object} [opts]   Baileys options + { retries, scope }.
 * @returns {Promise<*>}    The sock.sendMessage return value.
 */
async function safeSend(sock, jid, content, opts = {}) {
  if (!sock || typeof sock.sendMessage !== 'function') {
    throw new Error('safeSend: invalid sock');
  }
  const retries = Number.isInteger(opts.retries) ? opts.retries : DEFAULT_RETRIES;
  const scope = opts.scope || 'unknown';
  const sendOpts = { ...opts };
  delete sendOpts.retries;
  delete sendOpts.scope;

  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await sock.sendMessage(jid, content, sendOpts);
      sendsTotal.inc();
      if (attempt > 0) {
        log.info('send recovered after retry', { jid, scope, attempt });
      }
      return result;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        sendRetries.inc();
        log.warn('send failed, retrying', { jid, scope, attempt, err: err && err.message });
        await delay(BACKOFF_MS * (attempt + 1));
        continue;
      }
      sendFailures.inc();
      log.error('send failed, giving up', { jid, scope, attempts: attempt + 1, err: err && err.message });
      throw err;
    }
  }
  throw lastErr || new Error('safeSend: unknown failure');
}

module.exports = safeSend;
module.exports.safeSend = safeSend;
