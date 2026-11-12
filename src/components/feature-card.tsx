import type { LucideIcon } from "lucide-react";
import { ActionLink } from "./action-link";

type FeatureCardProps = {
  icon: LucideIcon;
  tone: "sky" | "mint";
  title: string;
  description: string;
  href: string;
  action: string;
};

export function FeatureCard({ icon: Icon, tone, title, description, href, action }: FeatureCardProps) {
  return (
    <article className="feature-card" data-tone={tone}>
      <span className="feature-icon">
        <Icon aria-hidden="true" size={26} strokeWidth={1.8} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="feature-action">
        <ActionLink href={href}>{action}</ActionLink>
      </div>
    </article>
  );
}
