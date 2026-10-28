import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Locus",
  description: "Version control for physical spaces. Commit a baseline photo, then see exactly what went missing.",
  appleWebApp: { capable: true, title: "Locus", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b0c0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-dvh">
        <div className="mx-auto min-h-dvh max-w-[480px] relative">{children}</div>
      </body>
    </html>
  );
}
