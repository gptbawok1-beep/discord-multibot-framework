import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../database.js";
import { parseCookiesAuto } from "./cookieParser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const MANAGED_COOKIES_PATH = path.join(__dirname, "../../../../data/cookies.txt");

export function reloadCookies() {
  // Safe reload placeholder
}

export function getCookiesStatus() {
  const meta = db.getSetting("cookiesMeta") || {
    active: false,
    count: 0,
    status: "none",
    uploadedAt: null,
    lastTestedAt: null,
    testResult: null,
  };

  // Cross check with file existence
  if (!fs.existsSync(MANAGED_COOKIES_PATH)) {
    meta.active = false;
    meta.count = 0;
    meta.status = "none";
  }
  return meta;
}

export function saveCookiesMeta(meta) {
  db.setSetting("cookiesMeta", meta);
}

export function clearCookiesMeta() {
  db.setSetting("cookiesMeta", null);
  if (fs.existsSync(MANAGED_COOKIES_PATH)) {
    try {
      fs.unlinkSync(MANAGED_COOKIES_PATH);
    } catch {}
  }
}

export function validateCookiesContent(content) {
  const parsed = parseCookiesAuto(content);
  return parsed.valid;
}

export function recordCookiesTest(ok, reason = "") {
  const meta = getCookiesStatus();
  meta.lastTestedAt = Date.now();
  meta.testResult = ok ? "success" : "failed";
  meta.status = ok ? "ACTIVE" : "EXPIRED";
  meta.testReason = reason;
  saveCookiesMeta(meta);
}
