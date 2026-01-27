"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import Navbar from "@/components/Navbar";

const solanaConnectors = toSolanaWalletConnectors();

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId || appId === "your_privy_app_id_here") {
    return (
      <>
        <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/70 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-sm">
                F
              </div>
              <span className="text-lg font-bold text-white">
                Friend<span className="text-violet-400">Bags</span>
              </span>
            </div>
            <span className="text-xs text-gray-600 bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/[0.06]">
              Set PRIVY_APP_ID to enable login
            </span>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#7C3AED",
          logo: undefined,
        },
        loginMethods: ["twitter"],
        embeddedWallets: {
          solana: {
            createOnLogin: "all-users",
          },
        },
        externalWallets: {
          solana: { connectors: solanaConnectors },
        },
      }}
    >
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </PrivyProvider>
  );
}
