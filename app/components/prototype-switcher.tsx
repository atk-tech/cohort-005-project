// PROTOTYPE, throwaway. Floating variant switcher for UI prototypes.
import { useEffect, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PrototypeSwitcher({
  variants,
  current: currentProp,
  cookieName,
  extra,
}: {
  variants: { key: string; name: string }[];
  // The variant in use when the URL has none (e.g. remembered in a cookie).
  current?: string;
  // Remember the choice across navigations that drop ?variant=.
  cookieName?: string;
  extra?: ReactNode;
}) {
  const [params, setParams] = useSearchParams();
  const current = params.get("variant") ?? currentProp ?? variants[0].key;
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current)
  );

  function go(delta: number) {
    const next = variants[(index + delta + variants.length) % variants.length];
    if (cookieName)
      document.cookie = `${cookieName}=${next.key}; path=/; SameSite=Lax`;
    setParams(
      (p) => {
        p.set("variant", next.key);
        return p;
      },
      { replace: true, preventScrollReset: true }
    );
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full border-2 border-amber-400 bg-zinc-900 px-2 py-1.5 text-sm text-white shadow-2xl">
      <span className="pl-2 text-xs font-bold uppercase tracking-wider text-amber-400">
        Prototype
      </span>
      <button
        onClick={() => go(-1)}
        className="rounded-full p-1 hover:bg-white/15"
        title="Previous (←)"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-48 text-center font-medium">
        {variants[index].key} ({variants[index].name})
      </span>
      <button
        onClick={() => go(1)}
        className="rounded-full p-1 hover:bg-white/15"
        title="Next (→)"
      >
        <ChevronRight className="size-4" />
      </button>
      {extra}
    </div>
  );
}
