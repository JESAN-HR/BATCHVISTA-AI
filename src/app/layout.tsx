import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "BatchVista AI · Industrial Visual Quality Intelligence",
  description:
    "A local-first visual inspection workspace. Real OCR, traceable findings, human decisions.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
