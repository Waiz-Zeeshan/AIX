import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          viewBox="0 0 40 40"
          width="28"
          height="28"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 36 L20 4 L36 36 L30 36 L26 26 L14 26 L10 36 Z M16 20 L24 20 L20 10 Z"
            fill="#ffffff"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
