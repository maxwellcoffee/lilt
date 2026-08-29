import type { Metadata, Viewport } from "next";
import { Fraunces, Geist_Mono } from "next/font/google";

import "./globals.css";

const serif = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lilt. Walk into a beat",
  description:
    "A hands-free instrument. AirPods hear your voice. Walking sets the tempo. Turning your head steers the music.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Lilt",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icon-192.png",
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0907",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${mono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-[#0b0907] text-[#f4efe6]">{children}</body>
    </html>
  );
}
