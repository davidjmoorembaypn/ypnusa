import { ImageResponse } from "next/og";

/** The "Y" mark on the brand gradient. The mark stays inside the maskable safe zone (80%). */
export function appIcon(size: number): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 55%, #09081b 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
          fontWeight: 800,
          fontSize: Math.round(size * 0.5),
        }}
      >
        Y
      </div>
    ),
    { width: size, height: size },
  );
}
