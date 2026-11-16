import type { LucideIcon } from "lucide-react";
import { ActionLink } from "./action-link";

type FeatureCardProps = {
  icon: LucideIcon;
  status: string;
  title: string;
  description: string;
  href: string;
  action: string;
};

export function FeatureCard({ icon: Icon, status, title, description, href, action }: FeatureCardProps) {
  return (
    <article className="feature-card">
      <div className="feature-meta">
        <span className="feature-icon">
          <Icon aria-hidden="true" size={24} strokeWidth={1.8} />
        </span>
        <span className="status-chip">{status}</span>
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="feature-action">
        <ActionLink href={href}>{action}</ActionLink>
      </div>
    </article>
  );
}
