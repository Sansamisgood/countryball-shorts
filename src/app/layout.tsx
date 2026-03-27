import type { Metadata } from "next";
import "./globals.css";
import GlobalErrorHandler from "@/components/GlobalErrorHandler";

export const metadata: Metadata = {
  title: "효주댁 컨트리볼 쇼츠 자동화 생성기",
  description: "뉴스 기반 컨트리볼 쇼츠 자동화 생성기",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <GlobalErrorHandler />
        {children}
      </body>
    </html>
  );
}
