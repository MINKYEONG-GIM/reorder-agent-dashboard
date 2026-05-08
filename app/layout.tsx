import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WH Item Weekly Basis Forecast Dashboard",
  description: "Ending sales projection based on last year's item weekly share excluding 50%+ discount weeks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
