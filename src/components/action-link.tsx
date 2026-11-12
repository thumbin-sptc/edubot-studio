import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function ActionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="action" href={href}>
      {children}
      <ArrowRight aria-hidden="true" size={17} />
    </Link>
  );
}
