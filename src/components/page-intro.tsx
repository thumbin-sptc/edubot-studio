import type { ReactNode } from "react";

type PageIntroProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export function PageIntro({ title, description, children }: PageIntroProps) {
  return (
    <section className="shell subpage">
      <h1>{title}</h1>
      <p className="page-description">{description}</p>
      {children && <div className="subpage-content">{children}</div>}
    </section>
  );
}

export function StatusPanel({ children }: { children: ReactNode }) {
  return (
    <div className="info-panel">
      <h2>준비 중</h2>
      <p>{children}</p>
    </div>
  );
}
