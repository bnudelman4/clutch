import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CLUTCH — Academic Intelligence",
  description: "Pre-exam academic intelligence tool for students",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
