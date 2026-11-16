"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function WizardStepList({ current, children }: { current: string | null; children: ReactNode }) {
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const container = list.current;
    const active = container?.querySelector('[aria-current="step"]');
    if (!container || !active) return;
    const bounds = container.getBoundingClientRect();
    const position = active.getBoundingClientRect();
    if (position.left < bounds.left + 4) container.scrollLeft -= bounds.left + 4 - position.left;
    else if (position.right > bounds.right - 4) container.scrollLeft += position.right - bounds.right + 4;
  }, [current]);

  return <ol ref={list}>{children}</ol>;
}
