import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    name: "CivicPulse",
    short_name: "CivicPulse",
    description: "A community issue board for local streets and public spaces.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfbfa",
    theme_color: "#fbfbfa",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  }, { headers: { "Content-Type": "application/manifest+json" } });
}
