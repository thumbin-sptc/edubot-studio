"use client";

import { BookOpen, House, WandSparkles } from "lucide-react";
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

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="site-nav" aria-label="주 메뉴">
      <ul className="nav-list">
        {primaryLinks.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="nav-link" aria-current={pathname === href ? "page" : undefined}>
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
  );
}
