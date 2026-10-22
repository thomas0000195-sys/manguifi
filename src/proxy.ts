import { NextRequest, NextResponse } from "next/server";

/**
 * Content-Security-Policy avec nonce par requête (documentation Next.js,
 * « Content Security Policy »). Remplace la directive `script-src 'unsafe-inline'`
 * de next.config.ts : seuls les scripts portant le nonce s'exécutent.
 *
 * style-src garde 'unsafe-inline' : l'application utilise des attributs
 * style="" dans le HTML rendu, que les nonces ne couvrent pas.
 *
 * Les pages doivent être rendues dynamiquement pour recevoir un nonce
 * (voir `export const dynamic` dans src/app/layout.tsx).
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: "/((?!_next/static|_next/image|icons/|manifest.webmanifest|sw.js|favicon.ico).*)",
};
