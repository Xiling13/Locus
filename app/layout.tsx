import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Locus",
  description: "Take one photo of a space. Next time, Locus tells you what's missing, what's new and what moved.",
  appleWebApp: { capable: true, title: "Locus", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#eeece7",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-dvh bg-paper">
        <div className="relative mx-auto min-h-dvh max-w-[480px] bg-paper min-[481px]:border-x min-[481px]:border-white">
          {children}
        </div>
      </body>
    </html>
  );
}
