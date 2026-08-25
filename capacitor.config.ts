import type { CapacitorConfig } from "@capacitor/cli";

// This app is server-rendered (Next.js, not a static export) — Capacitor
// runs it in "remote mode": the native shell is just a WebView pointed at
// the real production URL, not a bundled copy of the site. `webDir` below
// is required by the CLI but unused at runtime because `server.url` takes
// over; it must still point to a real, existing directory or `npx cap sync`
// fails, so it's set to `public` (already present) rather than left empty.
//
// BEFORE building for the app stores: replace server.url with the real
// production domain (once one exists — see SESSION_REPORT.md). Right now
// it points at the Cloudflare quick-tunnel URL used for local phone
// testing, which is temporary and will stop working the moment that
// tunnel process is closed.
const config: CapacitorConfig = {
  appId: "com.manguifi.app",
  appName: "Manguifi",
  webDir: "public",
  server: {
    url: "https://characters-hazardous-somewhere-certificates.trycloudflare.com",
    cleartext: false,
  },
  android: {
    // Camera + geolocation permissions are declared in
    // android/app/src/main/AndroidManifest.xml (added by `cap add android`).
  },
};

export default config;
