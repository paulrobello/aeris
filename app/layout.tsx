import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const SITE_ORIGIN = "https://aeris.pardev.net";
const description =
  "A cinematic, real-time boid laboratory for sculpting emergent flock behavior in three dimensions.";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "AERIS — Flock Dynamics Laboratory",
    template: "%s — AERIS",
  },
  description,
  applicationName: "AERIS",
  authors: [{ name: "AERIS Research Systems" }],
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
  },
  openGraph: {
    title: "AERIS — Flock Dynamics Laboratory",
    description,
    siteName: "AERIS",
    type: "website",
    url: SITE_ORIGIN,
    images: [
      {
        url: "/og.png",
        width: 1672,
        height: 941,
        alt: "AERIS spectral boid flock forming a luminous vortex",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AERIS — Flock Dynamics Laboratory",
    description,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#050608",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
