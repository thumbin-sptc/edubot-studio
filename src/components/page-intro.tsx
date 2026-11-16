import type { ReactNode } from "react";

type PageIntroProps = {
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
};

export function PageIntro({ title, description, children, className = "" }: PageIntroProps) {
  return (
    <section className={`shell subpage ${className}`.trimEnd()}>
      <header className="page-heading">
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </header>
      {children && <div className="subpage-content">{children}</div>}
    </section>
  );
}

export function StatusPanel({ children }: { children: ReactNode }) {
  return (
    <div className="info-panel status-panel">
      <h2>준비 중</h2>
      <p>{children}</p>
    </div>
  );
}
