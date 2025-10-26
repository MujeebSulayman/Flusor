import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import { Providers } from "./providers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flusor - Code was never meant to stay still",
  description: "Flusor - Code was never meant to stay still",
  icons: {
    icon: '/White-symbol.png',
    shortcut: '/White-symbol.png',
    apple: '/White-symbol.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark`}>
      <body className={`${GeistSans.className} bg-black text-white min-h-screen`}>
        <div className="min-h-screen bg-black">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
