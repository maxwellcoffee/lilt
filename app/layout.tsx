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
  title: "Lilt — walk into a beat",
  description:
    "A hands-free instrument. AirPods hear your voice. Walking sets the tempo. Turning your head steers the music.",
  appleWebApp: {
    capable: true,
    title: "Lilt",
    statusBarStyle: "black-translucent",
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
