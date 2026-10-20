import { ImageResponse } from "next/og";

export const alt = "ErgStats: connect your Concept2 Logbook to Claude and ChatGPT";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const bars = [7, 11, 14, 9];

/** Link preview for social posts and chat apps. */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#0b1514",
          color: "#f4f7f7",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, width: 88, height: 88, padding: 18, borderRadius: 22, background: "#13877f" }}>
            {bars.map((h, i) => (
              <div key={i} style={{ width: 10, height: h * 3.6, borderRadius: 5, background: "#f4f7f7" }} />
            ))}
          </div>
          <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: -1 }}>ergstats</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
            Your Concept2 Logbook in Claude and ChatGPT
          </div>
          <div style={{ fontSize: 32, color: "#9fb3b1" }}>RowErg, SkiErg and BikeErg splits, PBs and training load. Free MCP connector.</div>
        </div>
      </div>
    ),
    size,
  );
}
