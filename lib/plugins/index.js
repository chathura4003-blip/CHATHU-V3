'use strict';

/*
 * Plugin loader. Drop a `*.js` file into `lib/plugins/` and export an object:
 *
 *   module.exports = {
 *     name: 'my-plugin',
 *     onLoad({ commandRegistry, log, metrics, sock }) {
 *       commandRegistry.register({
 *         name: 'foo',
 *         category: 'Plugins',
 *         description: 'Says hi',
 *         async run({ sock, from, msg }) { await sock.sendMessage(from, { text: 'hi' }, { quoted: msg }); },
 *       });
 *     }
 *   };
 *
 * Plugins are discovered at startup. `index.js` (this file) is skipped.
 * Failures in any single plugin are isolated — the bot keeps running.
 */

const fs = require('fs');
const path = require('path');

const log = require('../logger').child('plugins');
const metrics = require('../metrics');

const pluginsLoaded = metrics.counter('chathu_plugins_loaded_total', null, 'Plugin modules successfully loaded at startup');
const pluginsFailed = metrics.counter('chathu_plugins_failed_total', null, 'Plugin modules that failed to load');

function discover(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name !== 'index.js' && name.endsWith('.js'))
    .map((name) => path.join(dir, name));
}

/**
 * @param {Object} ctx
 * @param {Object} ctx.commandRegistry  Object with `register({ name, category, run, description })`.
 * @param {Object} [ctx.sock]           Baileys socket (may be null at first load).
 * @param {Function} [ctx.onCommandRegistered]
 * @returns {{ loaded: string[], failed: { file: string, err: string }[] }}
 */
function loadAll(ctx) {
  const dir = __dirname;
  const files = discover(dir);
  const loaded = [];
  const failed = [];
  for (const file of files) {
    try {
      delete require.cache[require.resolve(file)];
      const mod = require(file);
      if (typeof mod.onLoad === 'function') {
        mod.onLoad({ ...ctx, log: log.child(mod.name || path.basename(file, '.js')), metrics });
      }
      loaded.push(mod.name || path.basename(file, '.js'));
      pluginsLoaded.inc();
    } catch (err) {
      failed.push({ file: path.basename(file), err: err && err.message ? err.message : String(err) });
      pluginsFailed.inc();
      log.error('failed to load plugin', { file: path.basename(file), err: err && err.message });
    }
  }
  if (loaded.length || failed.length) {
    log.info('plugin discovery complete', { loaded, failed });
  }
  return { loaded, failed };
}

module.exports = { loadAll, discover };
