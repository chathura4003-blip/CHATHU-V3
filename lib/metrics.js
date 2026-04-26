'use strict';

/*
 * Tiny Prometheus-format metrics registry.
 *
 * Avoids adding a new dependency (`prom-client` is heavyweight). Supports the
 * two metric types we actually need: counters (monotonically increasing)
 * and gauges (current value).
 *
 *   const m = require('./metrics');
 *   m.counter('chathu_messages_total').inc();
 *   m.counter('chathu_messages_total', { kind: 'group' }).inc();
 *   m.gauge('chathu_sessions_connected').set(1);
 *   const text = m.render(); // exposition format
 */

const _counters = new Map(); // key: `${name}|${labelHash}` → { name, help, labels, value }
const _gauges = new Map();
const _help = new Map();     // name → help text

function labelHash(labels) {
  if (!labels) return '';
  const keys = Object.keys(labels).sort();
  return keys.map(k => `${k}=${labels[k]}`).join(',');
}

function registerHelp(name, help) {
  if (help && !_help.has(name)) _help.set(name, help);
}

function counter(name, labels, help) {
  registerHelp(name, help);
  const key = `${name}|${labelHash(labels)}`;
  if (!_counters.has(key)) {
    _counters.set(key, { name, labels: labels || null, value: 0 });
  }
  const entry = _counters.get(key);
  return {
    inc: (n) => { entry.value += (typeof n === 'number' ? n : 1); },
    value: () => entry.value,
  };
}

function gauge(name, labels, help) {
  registerHelp(name, help);
  const key = `${name}|${labelHash(labels)}`;
  if (!_gauges.has(key)) {
    _gauges.set(key, { name, labels: labels || null, value: 0 });
  }
  const entry = _gauges.get(key);
  return {
    set: (v) => { entry.value = Number(v) || 0; },
    inc: (n) => { entry.value += (typeof n === 'number' ? n : 1); },
    dec: (n) => { entry.value -= (typeof n === 'number' ? n : 1); },
    value: () => entry.value,
  };
}

function fmtLabels(labels) {
  if (!labels) return '';
  const parts = Object.keys(labels)
    .sort()
    .map(k => `${k}="${String(labels[k]).replace(/"/g, '\\"')}"`);
  return parts.length ? `{${parts.join(',')}}` : '';
}

function renderSection(type, store) {
  const grouped = new Map();
  for (const entry of store.values()) {
    if (!grouped.has(entry.name)) grouped.set(entry.name, []);
    grouped.get(entry.name).push(entry);
  }
  let out = '';
  for (const [name, list] of grouped) {
    const help = _help.get(name);
    if (help) out += `# HELP ${name} ${help}\n`;
    out += `# TYPE ${name} ${type}\n`;
    for (const e of list) {
      out += `${name}${fmtLabels(e.labels)} ${e.value}\n`;
    }
  }
  return out;
}

function render() {
  // Defaults that should always be present.
  const proc = gauge('chathu_process_uptime_seconds', null, 'Bot process uptime in seconds');
  proc.set(Math.round(process.uptime()));
  const mem = process.memoryUsage();
  gauge('chathu_process_resident_memory_bytes', null, 'Resident set size in bytes').set(mem.rss);
  gauge('chathu_process_heap_used_bytes', null, 'V8 heap used in bytes').set(mem.heapUsed);

  return renderSection('counter', _counters) + renderSection('gauge', _gauges);
}

module.exports = {
  counter,
  gauge,
  render,
};
