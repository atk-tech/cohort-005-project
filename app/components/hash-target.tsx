// PROTOTYPE (#33): a Notification links to the exact thing it's about with a
// URL fragment (e.g. /settings#refund-request-12). Wrap each linkable element
// in <HashTarget id=…>: when the fragment matches, it scrolls into view and is
// highlighted. CSS :target doesn't update on client-side navigation, so this
// reads the fragment from the router.
import { useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router";
import { cn } from "~/lib/utils";

export function HashTarget({
  id,
  as: Tag = "div",
  className,
  children,
}: {
  id: string;
  as?: "div" | "tr";
  className?: string;
  children: ReactNode;
}) {
  const { hash } = useLocation();
  const ref = useRef<HTMLElement>(null);
  const isTarget = hash === `#${id}`;
  useEffect(() => {
    if (isTarget)
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [isTarget]);
  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      id={id}
      className={cn(
        className,
        "scroll-mt-4 transition-colors",
        isTarget &&
          (Tag === "tr"
            ? "bg-primary/10 outline-2 -outline-offset-2 outline-primary"
            : "ring-2 ring-primary ring-offset-2 ring-offset-background")
      )}
    >
      {children}
    </Tag>
  );
}
