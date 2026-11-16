import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function ActionLink({ href, children, ariaLabel }: { href: string; children: ReactNode; ariaLabel?: string }) {
  return (
    <Link className="action" href={href} aria-label={ariaLabel}>
      {children}
      <ArrowRight aria-hidden="true" size={17} />
    </Link>
  );
}
