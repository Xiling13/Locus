import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Locus",
  description: "Take one photo of a space. Next time, Locus tells you what's missing, what's new and what moved.",
  appleWebApp: { capable: true, title: "Locus", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#eeece7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-dvh">
        <div className="mx-auto min-h-dvh max-w-[480px] relative border-x border-white bg-paper">{children}</div>
      </body>
    </html>
  );
}
