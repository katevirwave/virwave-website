import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VirWave Events",
  description: "Breathe first. Then move. VirWave Events — the room knows before you walk in.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
