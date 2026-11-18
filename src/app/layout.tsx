import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import brandSymbol from "@/assets/brand/symbol.png";
import associationWordmark from "@/assets/brand/wordmark.svg";
import { Navigation, SkipLink } from "@/components/navigation";
import "./globals.css";
import "./prompts.css";
import "./prompts/catalog.css";

export const metadata: Metadata = {
  title: {
    default: "EDU-BOT Studio",
    template: "%s | EDU-BOT Studio",
  },
  description: "중도중복장애교육연구회가 제공하는 특수교육 교사의 프롬프트 작성 및 에듀봇 제작 도구입니다.",
  icons: { icon: { url: brandSymbol.src, type: "image/png", sizes: "160x160" } },
};

export const viewport: Viewport = { viewportFit: "cover", interactiveWidget: "resizes-content" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className={GeistSans.variable}>
        <SkipLink />
        <header className="site-header">
          <div className="shell header-inner">
            <Link href="/" className="wordmark">
              <Image src={brandSymbol} className="wordmark-symbol" alt="" loading="eager" />
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
              <Image src={associationWordmark} className="footer-wordmark" alt="경기도중도중복장애교육연구회" />
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
