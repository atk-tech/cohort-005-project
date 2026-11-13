// PROTOTYPE, throwaway. "What does the Notification Feed look like in Cadence?"
// (atk-tech/cohort-005-project#33). Lives on prototype/notification-feed only.
//
// Three variants of the Notification Feed, mounted in the app layout and
// switched with ?variant=:
//   A  Bell popover: bell next to the logo, badge = unseen, opening clears it.
//   B  Slide-over drawer: "Notifications" nav item, badge = unread, rows
//      grouped by day with the full note/snippet inline.
//   C  Inbox page: "Notifications" nav item → /notifications, a two-pane list
//      + detail with an explicit call to action. Badge = a dot while unseen.
//
// The feed is read straight from Knock's headless API in the browser with the
// public key + a server-signed user token (same as the Knock spike, #35).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link, NavLink, useFetcher, useNavigate } from "react-router";
import { Popover, Dialog } from "radix-ui";
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  CircleCheck,
  CircleX,
  GraduationCap,
  Inbox,
  MessageCircleQuestion,
  MessageSquareReply,
  Receipt,
  Settings,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { UserAvatar } from "~/components/user-avatar";
import { PrototypeSwitcher } from "~/components/prototype-switcher";

const KNOCK_API = "https://api.knock.app/v1";

export const FEED_VARIANTS = [
  { key: "A", name: "Bell popover" },
  { key: "B", name: "Slide-over drawer" },
  { key: "C", name: "Inbox page" },
];

export type FeedConfig = {
  knockUserId: string;
  userToken: string;
  publicApiKey: string;
  feedChannelId: string;
};

export type FeedItem = {
  id: string;
  inserted_at: string;
  read_at: string | null;
  seen_at: string | null;
  data: {
    kind: string;
    actorName: string | null;
    courseTitle: string;
    lessonTitle?: string;
    snippet?: string;
    note?: string;
    reason?: string;
    amountCents?: number;
    seatsLeft?: number;
    url: string;
    // PROTOTYPE: the seed replays past events, so it passes the real event
    // time. In production the Notification is created when the event happens.
    occurredAt?: string | null;
  };
};

const at = (item: FeedItem) => item.data.occurredAt ?? item.inserted_at;

type FeedMeta = {
  unread_count: number;
  unseen_count: number;
  total_count: number;
};

// ---------------------------------------------------------------- feed state

type FeedState = {
  items: FeedItem[];
  meta: FeedMeta;
  loaded: boolean;
  mark: (
    status: "read" | "unread" | "seen" | "archived",
    ids: string[]
  ) => Promise<void>;
  markAllRead: () => Promise<void>;
  markAllSeen: () => Promise<void>;
  refresh: () => void;
};

const FeedContext = createContext<FeedState | null>(null);

export function useFeed() {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error("useFeed outside NotificationFeedProvider");
  return ctx;
}

export function NotificationFeedProvider({
  config,
  children,
}: {
  config: FeedConfig | null;
  children: ReactNode;
}) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [meta, setMeta] = useState<FeedMeta>({
    unread_count: 0,
    unseen_count: 0,
    total_count: 0,
  });
  const [loaded, setLoaded] = useState(false);

  const headers = useMemo(
    () =>
      config && {
        Authorization: `Bearer ${config.publicApiKey}`,
        "X-Knock-User-Token": config.userToken,
        "Content-Type": "application/json",
      },
    [config?.publicApiKey, config?.userToken]
  );

  const refresh = useCallback(async () => {
    if (!config || !headers) return;
    const res = await fetch(
      `${KNOCK_API}/users/${config.knockUserId}/feeds/${config.feedChannelId}?page_size=50`,
      { headers }
    );
    if (!res.ok) return;
    const body = await res.json();
    setItems(
      [...body.entries].sort((x: FeedItem, y: FeedItem) =>
        at(y).localeCompare(at(x))
      )
    );
    setMeta(body.meta);
    setLoaded(true);
  }, [config?.knockUserId, headers]);

  // Switching DevUI users swaps the token, so reset and refetch.
  useEffect(() => {
    setItems([]);
    setLoaded(false);
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const mark = useCallback(
    async (status: "read" | "unread" | "seen" | "archived", ids: string[]) => {
      if (!headers || ids.length === 0) return; // empty batch → 422
      // Optimistic, so the UI reacts before the next poll.
      const now = new Date().toISOString();
      setItems((prev) =>
        (status === "archived"
          ? prev.filter((i) => !ids.includes(i.id))
          : prev
        ).map((i) =>
          !ids.includes(i.id)
            ? i
            : status === "read"
              ? { ...i, read_at: now, seen_at: i.seen_at ?? now }
              : status === "unread"
                ? { ...i, read_at: null }
                : { ...i, seen_at: now }
        )
      );
      await fetch(`${KNOCK_API}/messages/batch/${status}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message_ids: ids }),
        keepalive: true, // survives the navigation a row click triggers
      });
      refresh();
    },
    [headers, refresh]
  );

  const value: FeedState = {
    items,
    // Derive counts from items so optimistic updates show immediately.
    meta: loaded
      ? {
          ...meta,
          unread_count: items.filter((i) => !i.read_at).length,
          unseen_count: items.filter((i) => !i.seen_at).length,
        }
      : meta,
    loaded,
    mark,
    markAllRead: () =>
      mark(
        "read",
        items.filter((i) => !i.read_at).map((i) => i.id)
      ),
    markAllSeen: () =>
      mark(
        "seen",
        items.filter((i) => !i.seen_at).map((i) => i.id)
      ),
    refresh,
  };

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

// ------------------------------------------------------- per-kind rendering

type Described = {
  icon: ReactNode;
  tone: string;
  title: ReactNode;
  plain: string;
  body?: string;
  cta: string;
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function describe(item: FeedItem): Described {
  const d = item.data;
  const actor = <b className="font-semibold">{d.actorName ?? "Someone"}</b>;
  const course = <b className="font-semibold">{d.courseTitle}</b>;
  switch (d.kind) {
    case "refund-approved":
      return {
        icon: <CircleCheck className="size-4" />,
        tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        title: <>Your Refund Request for {course} was approved</>,
        plain: `Refund Request approved: ${d.courseTitle}`,
        body: d.note,
        cta: "View Refund Request",
      };
    case "refund-declined":
      return {
        icon: <CircleX className="size-4" />,
        tone: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
        title: <>Your Refund Request for {course} was declined</>,
        plain: `Refund Request declined: ${d.courseTitle}`,
        body: d.note
          ? `${d.note} You can ask again from the course page.`
          : undefined,
        cta: "View Refund Request",
      };
    case "refund-request-open":
      return {
        icon: <Receipt className="size-4" />,
        tone: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        title: (
          <>
            {actor} asked for a {money(d.amountCents ?? 0)} refund on {course}
          </>
        ),
        plain: `New Refund Request from ${d.actorName}`,
        body: d.reason,
        cta: "Review Refund Requests",
      };
    case "seat-claimed":
      return {
        icon: <UserPlus className="size-4" />,
        tone: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
        title: (
          <>
            {actor} claimed a Seat for {course}
          </>
        ),
        plain: `${d.actorName} claimed a Seat`,
        body: `${d.seatsLeft} Seats left on this Team Licence.`,
        cta: "Open Team",
      };
    case "enrollment":
      return {
        icon: <GraduationCap className="size-4" />,
        tone: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
        title: (
          <>
            {actor} enrolled in {course}
          </>
        ),
        plain: `${d.actorName} enrolled`,
        cta: "View Students",
      };
    case "discussion-question":
      return {
        icon: <MessageCircleQuestion className="size-4" />,
        tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
        title: (
          <>
            {actor} asked a question in{" "}
            <b className="font-semibold">{d.lessonTitle}</b>
          </>
        ),
        plain: `${d.actorName} asked a question`,
        body: d.snippet,
        cta: "Go to Discussion Question",
      };
    case "discussion-reply":
      return {
        icon: <MessageSquareReply className="size-4" />,
        tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
        title: (
          <>
            {actor} replied to your question in{" "}
            <b className="font-semibold">{d.lessonTitle}</b>
          </>
        ),
        plain: `${d.actorName} replied to your question`,
        body: d.snippet,
        cta: "Go to Discussion Reply",
      };
    default:
      return {
        icon: <Bell className="size-4" />,
        tone: "bg-muted text-muted-foreground",
        title: <>Something happened (unrecognised: {d.kind ?? "no kind"})</>,
        plain: "Notification",
        cta: "Open",
      };
  }
}

function ago(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

// Actor avatar when a person caused it, the kind's icon when the system did.
function Leading({
  item,
  size = "md",
}: {
  item: FeedItem;
  size?: "md" | "lg";
}) {
  const desc = describe(item);
  const box = size === "lg" ? "size-10" : "size-8";
  if (item.data.actorName) {
    return (
      <div className="relative shrink-0">
        <UserAvatar name={item.data.actorName} avatarUrl={null} />
        <span
          className={cn(
            "absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full ring-2 ring-background [&_svg]:size-2.5",
            desc.tone
          )}
        >
          {desc.icon}
        </span>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        box,
        desc.tone
      )}
    >
      {desc.icon}
    </div>
  );
}

function UnreadDot({ item }: { item: FeedItem }) {
  return (
    <span
      className={cn(
        "mt-1.5 size-2 shrink-0 rounded-full",
        item.read_at ? "bg-transparent" : "bg-blue-500"
      )}
      title={item.read_at ? "Read" : "Unread"}
    />
  );
}

function useOpenItem() {
  const { mark } = useFeed();
  const navigate = useNavigate();
  return (item: FeedItem, after?: () => void) => {
    if (!item.read_at) mark("read", [item.id]);
    after?.();
    navigate(item.data.url);
  };
}

function SettingsLink({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      to="/settings#notifications"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <Settings className="size-3.5" /> Notification Preferences
    </Link>
  );
}

function EmptyState({ unreadOnly }: { unreadOnly?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-muted-foreground">
      <Inbox className="size-8 opacity-40" />
      {unreadOnly ? "You're all caught up." : "No Notifications yet."}
    </div>
  );
}

// ------------------------------------------------------ Variant A: popover

export function VariantABell() {
  const feed = useFeed();
  const openItem = useOpenItem();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"unread" | "all">("all");
  const shown =
    tab === "unread" ? feed.items.filter((i) => !i.read_at) : feed.items;

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) feed.markAllSeen(); // opening clears the badge (seen ≠ read)
      }}
    >
      <Popover.Trigger
        className="relative rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        title="Notifications"
      >
        {feed.meta.unseen_count > 0 ? (
          <BellRing className="size-5" />
        ) : (
          <Bell className="size-5" />
        )}
        {feed.meta.unseen_count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {feed.meta.unseen_count > 9 ? "9+" : feed.meta.unseen_count}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="start"
          sideOffset={12}
          className="z-50 flex max-h-[70vh] w-96 flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-semibold">Notifications</h2>
            <button
              onClick={feed.markAllRead}
              disabled={feed.meta.unread_count === 0}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <CheckCheck className="size-3.5" /> Mark all as read
            </button>
          </div>
          <div className="flex gap-4 border-b px-4 text-sm">
            {(["all", "unread"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "-mb-px border-b-2 py-2 capitalize",
                  tab === t
                    ? "border-primary font-medium"
                    : "border-transparent text-muted-foreground"
                )}
              >
                {t}
                {t === "unread" &&
                  feed.meta.unread_count > 0 &&
                  ` (${feed.meta.unread_count})`}
              </button>
            ))}
          </div>
          <ul className="flex-1 overflow-y-auto">
            {shown.length === 0 && <EmptyState unreadOnly={tab === "unread"} />}
            {shown.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => openItem(item, () => setOpen(false))}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-accent",
                    !item.read_at && "bg-blue-50/60 dark:bg-blue-950/30"
                  )}
                >
                  <Leading item={item} />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 leading-snug">
                      {describe(item).title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {ago(at(item))}
                    </p>
                  </div>
                  <UnreadDot item={item} />
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t px-4 py-2">
            <SettingsLink onClick={() => setOpen(false)} />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ------------------------------------------------------- Variant B: drawer

function dayGroup(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return "Earlier";
}

export function VariantBDrawerNavItem() {
  const feed = useFeed();
  const openItem = useOpenItem();
  const [open, setOpen] = useState(false);

  const groups = feed.items.reduce<Record<string, FeedItem[]>>((acc, i) => {
    (acc[dayGroup(at(i))] ??= []).push(i);
    return acc;
  }, {});

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) feed.markAllSeen();
      }}
    >
      <Dialog.Trigger className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
        <Bell className="size-4" />
        Notifications
        {feed.meta.unread_count > 0 && (
          <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
            {feed.meta.unread_count}
          </span>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[440px] max-w-full flex-col border-l bg-background shadow-2xl">
          <div className="flex items-start justify-between border-b px-6 py-5">
            <div>
              <Dialog.Title className="text-lg font-semibold">
                Notifications
              </Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                {feed.meta.unread_count} unread
              </Dialog.Description>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={feed.markAllRead}
                disabled={feed.meta.unread_count === 0}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent disabled:opacity-40"
              >
                Mark all as read
              </button>
              <Dialog.Close className="rounded-md p-1.5 hover:bg-accent">
                <X className="size-4" />
              </Dialog.Close>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {feed.items.length === 0 && <EmptyState />}
            {["Today", "Yesterday", "Earlier"].map(
              (g) =>
                groups[g] && (
                  <section key={g}>
                    <h3 className="sticky top-0 bg-background/95 px-6 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                      {g}
                    </h3>
                    <ul className="space-y-1 px-3 pb-2">
                      {groups[g].map((item) => {
                        const desc = describe(item);
                        return (
                          <li key={item.id} className="group relative">
                            <button
                              onClick={() =>
                                openItem(item, () => setOpen(false))
                              }
                              className={cn(
                                "flex w-full items-start gap-3 rounded-lg p-3 text-left text-sm transition-colors hover:bg-accent",
                                item.read_at && "opacity-60"
                              )}
                            >
                              <UnreadDot item={item} />
                              <Leading item={item} />
                              <div className="min-w-0 flex-1">
                                <p className="leading-snug">{desc.title}</p>
                                {desc.body && (
                                  <p className="mt-1.5 line-clamp-3 border-l-2 pl-2 text-muted-foreground">
                                    {desc.body}
                                  </p>
                                )}
                                <p className="mt-1.5 text-xs text-muted-foreground">
                                  {item.data.courseTitle} · {ago(at(item))}
                                </p>
                              </div>
                            </button>
                            <button
                              onClick={() =>
                                feed.mark(item.read_at ? "unread" : "read", [
                                  item.id,
                                ])
                              }
                              title={
                                item.read_at ? "Mark as unread" : "Mark as read"
                              }
                              className="absolute top-3 right-3 hidden rounded-md border bg-background p-1 text-muted-foreground shadow-sm group-hover:block hover:text-foreground"
                            >
                              <Check className="size-3.5" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )
            )}
          </div>
          <div className="border-t px-6 py-3">
            <SettingsLink onClick={() => setOpen(false)} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------- Variant C: inbox page

export function VariantCNavItem() {
  const feed = useFeed();
  return (
    <NavLink
      to="/notifications?variant=C"
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      <span className="relative">
        <Bell className="size-4" />
        {feed.meta.unseen_count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-red-500 ring-2 ring-sidebar" />
        )}
      </span>
      Notifications
    </NavLink>
  );
}

const C_FILTERS: { key: string; label: string; kinds: string[] | null }[] = [
  { key: "all", label: "All", kinds: null },
  { key: "unread", label: "Unread", kinds: null },
  {
    key: "discussion",
    label: "Discussions",
    kinds: ["discussion-question", "discussion-reply"],
  },
  {
    key: "refunds",
    label: "Refunds",
    kinds: ["refund-approved", "refund-declined", "refund-request-open"],
  },
  {
    key: "people",
    label: "Enrollments & Seats",
    kinds: ["enrollment", "seat-claimed"],
  },
];

export function VariantCInboxPage() {
  const feed = useFeed();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Visiting the page counts as seeing everything.
  useEffect(() => {
    if (feed.meta.unseen_count > 0) feed.markAllSeen();
  }, [feed.meta.unseen_count]);

  const f = C_FILTERS.find((x) => x.key === filter)!;
  const shown = feed.items.filter((i) =>
    filter === "unread"
      ? !i.read_at
      : f.kinds
        ? f.kinds.includes(i.data.kind)
        : true
  );
  const selected = feed.items.find((i) => i.id === selectedId) ?? null;

  function select(item: FeedItem) {
    setSelectedId(item.id);
    if (!item.read_at) feed.mark("read", [item.id]); // selecting reads it
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {feed.meta.unread_count} unread of {feed.meta.total_count}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <SettingsLink />
          <button
            onClick={feed.markAllRead}
            disabled={feed.meta.unread_count === 0}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40"
          >
            <CheckCheck className="size-4" /> Mark all as read
          </button>
        </div>
      </header>
      <div className="flex gap-2 border-b px-6 py-2">
        {C_FILTERS.map((x) => (
          <button
            key={x.key}
            onClick={() => setFilter(x.key)}
            className={cn(
              "rounded-full px-3 py-1 text-sm",
              filter === x.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent"
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1">
        <ul className="w-[420px] shrink-0 overflow-y-auto border-r">
          {shown.length === 0 && (
            <EmptyState unreadOnly={filter === "unread"} />
          )}
          {shown.map((item) => {
            const desc = describe(item);
            return (
              <li key={item.id}>
                <button
                  onClick={() => select(item)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b px-4 py-3 text-left text-sm",
                    selectedId === item.id ? "bg-accent" : "hover:bg-accent/50"
                  )}
                >
                  <UnreadDot item={item} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className={cn(
                          "truncate",
                          !item.read_at && "font-semibold"
                        )}
                      >
                        {desc.plain}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {ago(at(item))}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {desc.body ?? item.data.courseTitle}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex-1 overflow-y-auto p-8">
          {selected ? (
            (() => {
              const desc = describe(selected);
              return (
                <article className="max-w-xl space-y-5">
                  <div className="flex items-center gap-3">
                    <Leading item={selected} size="lg" />
                    <div className="text-sm text-muted-foreground">
                      {new Date(at(selected)).toLocaleString()}
                    </div>
                  </div>
                  <h2 className="text-xl leading-snug">{desc.title}</h2>
                  {desc.body && (
                    <blockquote className="rounded-lg border bg-muted/40 p-4 text-sm">
                      {desc.body}
                    </blockquote>
                  )}
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Course</dt>
                    <dd>{selected.data.courseTitle}</dd>
                    {selected.data.lessonTitle && (
                      <>
                        <dt className="text-muted-foreground">Lesson</dt>
                        <dd>{selected.data.lessonTitle}</dd>
                      </>
                    )}
                  </dl>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(selected.data.url)}
                      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      {desc.cta}
                    </button>
                    <button
                      onClick={() => feed.mark("unread", [selected.id])}
                      className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
                    >
                      Mark as unread
                    </button>
                  </div>
                </article>
              );
            })()
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select a Notification
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------- switcher + state readout

export function NotificationFeedPrototypeBar() {
  const feed = useFeed();
  const seed = useFetcher<{ seeded: string[] }>();
  useEffect(() => {
    if (!seed.data) return;
    const kinds = seed.data.seeded;
    if (kinds.length === 0)
      toast.info(
        "Nothing to seed: this user would receive no Notifications from the data in data.db."
      );
    else toast.success(`Seeded ${kinds.length}: ${kinds.join(", ")}`);
    setTimeout(feed.refresh, 2500);
  }, [seed.data]);

  return (
    <PrototypeSwitcher
      variants={FEED_VARIANTS}
      extra={
        <>
          <span className="border-l border-white/20 pl-2 font-mono text-xs text-white/70">
            unseen {feed.meta.unseen_count} · unread {feed.meta.unread_count} ·
            total {feed.meta.total_count}
          </span>
          <seed.Form method="post" action="/api/prototype-seed-notifications">
            <button
              type="submit"
              disabled={seed.state !== "idle"}
              className="rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-zinc-900 hover:bg-amber-300 disabled:opacity-50"
            >
              {seed.state !== "idle" ? "Seeding…" : "Seed my Notifications"}
            </button>
          </seed.Form>
          <button
            onClick={() =>
              feed.mark(
                "archived",
                feed.items.map((i) => i.id)
              )
            }
            disabled={feed.items.length === 0}
            className="rounded-full px-3 py-1 text-xs text-white/80 hover:bg-white/15 disabled:opacity-40"
            title="Archive every Notification in my feed"
          >
            Clear
          </button>
        </>
      }
    />
  );
}
