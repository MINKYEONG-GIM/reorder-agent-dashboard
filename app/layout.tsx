import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "리오더 에이전트",
  description: "스타일코드별 주차 판매량 예측과 연말 판매량 예측을 확인하는 대시보드",
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
