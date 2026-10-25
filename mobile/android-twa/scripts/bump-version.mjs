// Incrémente appVersionCode (entier croissant exigé par Google Play) et appVersionName (1.0.0 → 1.0.1).
// Usage : node mobile/android-twa/scripts/bump-version.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "twa-manifest.json");
const manifest = JSON.parse(readFileSync(file, "utf8"));

manifest.appVersionCode = Number(manifest.appVersionCode) + 1;
const [major, minor, patch] = String(manifest.appVersionName).split(".").map(Number);
manifest.appVersionName = `${major}.${minor}.${patch + 1}`;

writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`Version ${manifest.appVersionName} (code ${manifest.appVersionCode})`);
