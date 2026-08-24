import { ImageResponse } from "next/og";
import { ManguifiMark } from "@/lib/pwa-icon";

export const dynamic = "force-static";

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
          borderRadius: 40,
        }}
      >
        <ManguifiMark scale={6} />
      </div>
    ),
    { width: 192, height: 192 }
  );
}
