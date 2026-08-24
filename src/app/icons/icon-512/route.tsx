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
          borderRadius: 108,
        }}
      >
        <ManguifiMark scale={16} />
      </div>
    ),
    { width: 512, height: 512 }
  );
}
