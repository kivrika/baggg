import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FriendBags - Social Token Trading",
  description: "Trade social tokens on Solana. Every creator gets a coin.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#030303] text-white min-h-screen bg-mesh`}
      >
        <Providers>
          <div className="min-h-screen">
            <Navbar />
            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
              {children}
            </main>

            {/* Footer */}
            <footer className="border-t border-white/[0.05] mt-20">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-6 text-sm text-gray-600">
                    <a href="https://solscan.io" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">
                      Solscan
                    </a>
                    <a href="https://bags.fm" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">
                      Powered by Bags
                    </a>
                  </div>
                  <a
                    href="https://x.com/friendsbagss"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg hover:bg-white/[0.05] text-gray-500 hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                  <p className="text-xs text-gray-700 mt-2">
                    © 2026 FriendBags. All rights reserved.
                  </p>
                </div>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
