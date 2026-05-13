import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, #100020 0%, #200040 50%, #401080 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <svg
          viewBox="0 0 120 40"
          width="140"
          height="46"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2 38 L18 2 L34 38 L28 38 L24 28 L12 28 L8 38 Z M14 22 L22 22 L18 12 Z"
            fill="#ffffff"
          />
          <rect x="54" y="2" width="8" height="36" fill="#ffffff" />
          <path
            d="M82 20 L100 2 L118 20 L100 38 Z M88 20 L100 8 L112 20 L100 32 Z"
            fill="#ffffff"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
