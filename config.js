"use strict";

const path = require("path");
const DEFAULT_ADMIN_PASS = "chathura123";
const DEFAULT_JWT_SECRET = "replace_this_jwt_secret_before_production";

function readInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

// Parse the common set of strings users write to flip a boolean env var to
// "off": false / 0 / no / off / disable (case-insensitive). Anything else —
// including empty string — falls back to the supplied default.
function readBool(value, fallback = true) {
  if (value === undefined || value === null) return fallback;
  const normalised = String(value).trim().toLowerCase();
  if (normalised === "") return fallback;
  if (["false", "0", "no", "off", "disable", "disabled"].includes(normalised)) return false;
  if (["true", "1", "yes", "on", "enable", "enabled"].includes(normalised)) return true;
  return fallback;
}

module.exports = {
  BOT_NAME: process.env.BOT_NAME || "Chathu MD",
  OWNER_NUMBER: process.env.OWNER_NUMBER || "94742514900",
  PREFIX: process.env.PREFIX || ".",
  PORT: readInt(process.env.PORT, 5000),
  ADMIN_USER: readString(process.env.ADMIN_USER, "admin"),
  // Fall back to the documented defaults so an upgrade with no .env edit
  // doesn't lock the user out of the dashboard. Production deployments must
  // override these — bcrypt-hash ADMIN_PASS with `npm run hash-pass` and set
  // a long random JWT_SECRET. We log a loud warning at boot when defaults
  // are in use (see index.js).
  ADMIN_PASS: readString(process.env.ADMIN_PASS, DEFAULT_ADMIN_PASS),
  JWT_SECRET: readString(process.env.JWT_SECRET, DEFAULT_JWT_SECRET),
  // No default value: .setowner accepts this code to grant bot-owner
  // privileges to ANY sender, so a hardcoded fallback would ship a public
  // backdoor. Deployments must set PREMIUM_CODE in .env; when unset or
  // blank, setowner rejects the command (see lib/commands/owner.js).
  PREMIUM_CODE: readString(process.env.PREMIUM_CODE, ""),
  SESSION_DIR: path.join(__dirname, "session"),
  DOWNLOAD_DIR: path.join(__dirname, "downloads"),
  BROWSER: ["Ubuntu", "Chrome", "20.0.04"],
  SEARCH_CACHE_TTL: readInt(process.env.SEARCH_CACHE_TTL, 300000),
  DOWNLOAD_CACHE_TTL: readInt(process.env.DOWNLOAD_CACHE_TTL, 10 * 60 * 1000),
  AUTO_READ: readBool(process.env.AUTO_READ, true),
  AUTO_TYPING: readBool(process.env.AUTO_TYPING, true),
  NSFW_ENABLED: readBool(process.env.NSFW_ENABLED, true),
  WORK_MODE: process.env.WORK_MODE || "public",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  GROQ_API_KEY: process.env.GROQ_API_KEY || "",
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
  DEFAULT_ADMIN_PASS,
  DEFAULT_JWT_SECRET,
};
