import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:4203";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = new URL(`${protocol}://${host}`);
  const description =
    "A cinematic, real-time boid laboratory for sculpting emergent flock behavior in three dimensions.";

  return {
    metadataBase: origin,
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
      url: origin,
      images: [
        {
          url: new URL("/og.png", origin),
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
      images: [new URL("/og.png", origin)],
    },
  };
}

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
