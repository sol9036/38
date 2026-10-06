import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "지점별 매출 관리 시스템",
  description: "지점장 매출 입력 및 대표님 실시간 매출 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
