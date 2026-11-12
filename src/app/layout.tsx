import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import Link from "next/link";
import type { ReactNode } from "react";
import { Navigation } from "@/components/navigation";
import "./globals.css";
import "./prompts.css";
import "./prompts/catalog.css";

export const metadata: Metadata = {
  title: {
    default: "EDU-BOT Studio",
    template: "%s | EDU-BOT Studio",
  },
  description: "중도중복장애교육연구회가 준비하는 특수교육 교사를 위한 무료 AI 활용 안내입니다.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className={GeistSans.variable}>
        <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>
        <header className="site-header">
          <div className="shell header-inner">
            <Link href="/" className="wordmark">
              EDU-BOT <span>Studio</span>
            </Link>
            <Navigation />
          </div>
        </header>
        <main id="main-content" className="flex-1" tabIndex={-1}>
          {children}
        </main>
        <footer className="site-footer">
          <div className="shell footer-inner">
            <div>
              <p className="footer-name">중도중복장애교육연구회</p>
              <p className="footer-note">외부 AI를 이용할 때는 학생 정보를 익명화해 주세요.</p>
            </div>
            <nav className="footer-links" aria-label="하단 안내">
              <Link href="/help">이용 안내</Link>
              <Link href="/data">내 데이터 관리</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
