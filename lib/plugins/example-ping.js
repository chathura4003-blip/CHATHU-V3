'use strict';

/*
 * Example plugin. Demonstrates the plugin contract — copy it as a starting point.
 * Disabled by default; enable by setting CHATHU_PLUGIN_PING=1.
 */

module.exports = {
  name: 'example-ping',
  onLoad({ log }) {
    if (process.env.CHATHU_PLUGIN_PING !== '1') {
      log.debug('example-ping skipped (set CHATHU_PLUGIN_PING=1 to enable)');
      return;
    }
    log.info('example-ping plugin enabled');
    // A real plugin would call commandRegistry.register({...}) here.
    // Kept intentionally side-effect-free so existing setups are unaffected.
  },
};
