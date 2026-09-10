import type { Metadata, Viewport } from "next";
import "@fontsource/nunito-sans/latin-400.css";
import "@fontsource/nunito-sans/latin-600.css";
import "@fontsource/nunito-sans/latin-700.css";
import "@fontsource/nunito-sans/latin-800.css";
import "@fontsource/fraunces/latin-600.css";
import "@fontsource/fraunces/latin-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buscabolets · Una petita aventura al bosc",
  description:
    "Explora el bosc, segueix les pistes i omple el cistell. Un joc de bolets i petits grans talents, en català.",
  applicationName: "Buscabolets",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Buscabolets",
  },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  themeColor: "#f5f3e9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ca">
      <body>{children}</body>
    </html>
  );
}
