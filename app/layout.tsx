import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AuthProvider } from "./components/AuthProvider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return {
    metadataBase: new URL(`${protocol}://${host}`),
    title: { default: "CampusGig", template: "%s — CampusGig" },
    description: "Protected campus work with local payments and optional global USDC settlement on Solana.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "CampusGig — Safe campus work. Payment protected.",
      description: "Protected campus work with local payments and optional global USDC settlement on Solana.",
      type: "website",
      images: [{ url: "/og.png", width: 1732, height: 909, alt: "CampusGig protected student gig marketplace" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "CampusGig — Safe campus work. Payment protected.",
      description: "Protected campus work with local payments and optional global USDC settlement on Solana.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
