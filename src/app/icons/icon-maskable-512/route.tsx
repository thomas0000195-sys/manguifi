import { ImageResponse } from "next/og";
import { ManguifiMark } from "@/lib/pwa-icon";

export const dynamic = "force-static";

// Maskable icons get cropped to a circle/squircle by the OS, so the mark
// must sit within the inner ~80% "safe zone" — no rounded corners here,
// the background fills edge-to-edge and extra padding keeps the glyph safe.
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1a36",
        }}
      >
        <ManguifiMark scale={11} />
      </div>
    ),
    { width: 512, height: 512 }
  );
}
