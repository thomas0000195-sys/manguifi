import { ImageResponse } from "next/og";
import { ManguifiMark } from "@/lib/pwa-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        <ManguifiMark scale={5.6} />
      </div>
    ),
    size
  );
}
