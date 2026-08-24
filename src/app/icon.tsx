import { ImageResponse } from "next/og";
import { ManguifiMark } from "@/lib/pwa-icon";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 7,
        }}
      >
        <ManguifiMark />
      </div>
    ),
    size
  );
}
