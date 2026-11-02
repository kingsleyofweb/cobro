import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cobro Invoice Pay - Powered by Textile FX on Celo",
  description: "Seamless exact-output stablecoin invoice settlements on Celo via UniswapX LimitOrderReactor",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-celo-green selection:text-black">
        {children}
      </body>
    </html>
  );
}
