import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Locus",
  description: "Take one photo of a space. Next time, Locus tells you what's missing, what's new and what moved.",
  appleWebApp: { capable: true, title: "Locus", statusBarStyle: "default" },
  // Versioned PNG so Safari can pick up a new tab icon (it caches /favicon.ico aggressively).
  icons: {
    icon: [
      { url: "/brand/favicon.png?v=20261104", type: "image/png", sizes: "256x256" },
      { url: "/icon.png", type: "image/png", sizes: "48x48" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "256x256", type: "image/png" }],
  },
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
        <div className="relative mx-auto min-h-dvh max-w-[480px] bg-paper">
          {children}
        </div>
      </body>
    </html>
  );
}
