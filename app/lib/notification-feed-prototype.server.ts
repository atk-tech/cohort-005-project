// PROTOTYPE, throwaway. "What does the Notification Feed look like in Cadence?"
// (atk-tech/cohort-005-project#33). Lives on prototype/notification-feed only.
import Knock, { signUserToken } from "@knocklabs/node";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { db } from "~/db";
import { comments, courses, lessons, users } from "~/db/schema";

if (!process.env.KNOCK_SECRET_API_KEY) {
  // Vite doesn't put non-VITE_ vars on process.env, so load .env ourselves.
  process.loadEnvFile(".env");
}

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`PROTOTYPE: ${name} missing from .env`);
  return value;
}

const knock = new Knock({ apiKey: env("KNOCK_SECRET_API_KEY") });

export async function getFeedConfig(cadenceUserId: number) {
  return {
    knockUserId: String(cadenceUserId),
    userToken: await signUserToken(String(cadenceUserId), {
      signingKey: env("KNOCK_SIGNING_KEY"),
      expiresInSeconds: 60 * 60,
    }),
    publicApiKey: env("KNOCK_PUBLIC_API_KEY"),
    feedChannelId: env("KNOCK_FEED_CHANNEL_ID"),
  };
}

// The kinds from the v1 catalogue (#29). The row renderer switches on `kind`.
export type FeedKind =
  | "refund-approved"
  | "refund-declined"
  | "refund-request-open"
  | "seat-claimed"
  | "enrollment"
  | "discussion-question"
  | "discussion-reply";

// Seeds one of each catalogue Notification into the current user's feed,
// regardless of their role, so every row type can be judged side by side.
// Shortcut: only `discussion-reply` and `new-enrollment` workflows exist in
// Knock Development, so every kind goes through `discussion-reply` with a
// `kind` in its data. The feed is headless, so the template doesn't matter.
export async function seedSampleNotifications(cadenceUserId: number) {
  const me = db.select().from(users).where(eq(users.id, cadenceUserId)).get()!;
  const others = db
    .select()
    .from(users)
    .where(ne(users.id, cadenceUserId))
    .limit(4)
    .all();
  const course = db.select().from(courses).limit(1).get()!;
  const comment = db
    .select({
      id: comments.id,
      body: comments.body,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
    })
    .from(comments)
    .innerJoin(lessons, eq(lessons.id, comments.lessonId))
    .where(and(isNull(comments.parentId), isNull(comments.deletedAt)))
    .orderBy(desc(comments.createdAt))
    .get();

  const lessonTitle = comment?.lessonTitle ?? "Introduction";
  const lessonUrl = comment
    ? `/courses/${course.slug}/lessons/${comment.lessonId}#comment-${comment.id}`
    : `/courses/${course.slug}`;
  const snippet = (
    comment?.body ?? "How does this work with nested routes?"
  ).slice(0, 120);
  const who = (i: number) => others[i % others.length];

  const samples: {
    kind: FeedKind;
    actor: (typeof others)[number] | null;
    data: Record<string, unknown>;
  }[] = [
    {
      kind: "refund-declined",
      actor: null,
      data: {
        courseTitle: course.title,
        note: "You've completed most of the course, so this falls outside the refund window.",
        url: `/courses/${course.slug}`,
      },
    },
    {
      kind: "enrollment",
      actor: who(3),
      data: {
        courseTitle: course.title,
        url: `/instructor/${course.id}/students`,
      },
    },
    {
      kind: "seat-claimed",
      actor: who(2),
      data: { courseTitle: course.title, seatsLeft: 3, url: "/team" },
    },
    {
      kind: "refund-request-open",
      actor: who(1),
      data: {
        courseTitle: course.title,
        amountCents: 4900,
        reason: "The course wasn't what I expected from the description.",
        url: "/admin/refunds",
      },
    },
    {
      kind: "discussion-question",
      actor: who(0),
      data: { courseTitle: course.title, lessonTitle, snippet, url: lessonUrl },
    },
    {
      kind: "refund-approved",
      actor: null,
      data: {
        courseTitle: course.title,
        note: "Sorry it wasn't a fit!",
        url: `/courses/${course.slug}`,
      },
    },
    {
      kind: "discussion-reply",
      actor: who(1),
      data: { courseTitle: course.title, lessonTitle, snippet, url: lessonUrl },
    },
  ];

  // Sequential so inserted_at orders them; the last one is the newest.
  for (const s of samples) {
    await knock.workflows.trigger("discussion-reply", {
      recipients: [{ id: String(me.id), name: me.name, email: me.email }],
      actor: s.actor
        ? { id: String(s.actor.id), name: s.actor.name, email: s.actor.email }
        : undefined,
      data: { kind: s.kind, actorName: s.actor?.name ?? null, ...s.data },
    });
  }
  return samples.length;
}
