import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebPulse AI - Self-Healing Web Intelligence",
  description: "Self-healing web scraping and intelligence powered by Bright Data Scraper Studio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
