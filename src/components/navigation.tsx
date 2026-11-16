"use client";

import { BookOpen, FolderOpen, House, WandSparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const primaryLinks = [
  { href: "/", label: "홈", icon: House },
  { href: "/create", label: "에듀봇", icon: WandSparkles },
  { href: "/prompts", label: "프롬프트", icon: BookOpen },
];

const secondaryLinks = [
  { href: "/data", label: "내 데이터 관리" },
  { href: "/help", label: "이용 안내" },
];

export function SkipLink() {
  return (
    <a href="#main-content" className="skip-link" onClick={(event) => {
      const main = document.getElementById("main-content");
      if (!main) return;
      event.preventDefault();
      main.focus({ preventScroll: true });
      main.scrollIntoView({ block: "start" });
    }}>본문으로 건너뛰기</a>
  );
}

export function Navigation() {
  const pathname = usePathname().replace(/\/$/, "") || "/";

  return (
    <>
      <nav className="site-nav" aria-label="주 메뉴">
        <ul className="nav-list">
          {primaryLinks.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="nav-link"
                aria-current={pathname === href ? "page" : href !== "/" && pathname.startsWith(href + "/") ? "location" : undefined}>
                <Icon className="nav-icon" aria-hidden="true" size={21} />
                <span>{label}</span>
              </Link>
            </li>
          ))}
          {secondaryLinks.map(({ href, label }) => (
            <li key={href} className="nav-secondary">
              <Link href={href} className="nav-link" aria-current={pathname === href ? "page" : undefined}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <Link className="mobile-data-link" href="/data" aria-current={pathname === "/data" ? "page" : undefined}>
        <FolderOpen aria-hidden="true" size={18} />
        내 데이터
      </Link>
    </>
  );
}
