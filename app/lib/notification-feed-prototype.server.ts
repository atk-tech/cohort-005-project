// PROTOTYPE, throwaway. "What does the Notification Feed look like in Cadence?"
// (atk-tech/cohort-005-project#33). Lives on prototype/notification-feed only.
import Knock, { signUserToken } from "@knocklabs/node";
import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "~/db";
import {
  comments,
  coupons,
  courses,
  enrollments,
  lessons,
  modules,
  purchases,
  refunds,
  RefundStatus,
  UserRole,
  users,
} from "~/db/schema";

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

type Sample = {
  kind: FeedKind;
  actor: { id: number; name: string; email: string } | null;
  data: Record<string, unknown>;
};

const lessonUrl = (slug: string, lessonId: number, commentId: number) =>
  `/courses/${slug}/lessons/${lessonId}#comment-${commentId}`;

// Seeds the current user's feed with the catalogue Notifications (#29) they
// would really receive, built from real rows in data.db: only Notifications
// whose facts exist (a real Discussion Reply to their own question, a real
// decided Refund Request on their own Purchase, ...). Kinds with no matching
// row are skipped and reported back.
// Shortcut: only `discussion-reply` and `new-enrollment` workflows exist in
// Knock Development, so every kind goes through `discussion-reply` with a
// `kind` in its data. The feed is headless, so the template doesn't matter.
export async function seedSampleNotifications(cadenceUserId: number) {
  const me = db.select().from(users).where(eq(users.id, cadenceUserId)).get()!;
  const samples: Sample[] = [];
  const parent = alias(comments, "parent");
  const asker = alias(users, "asker");

  // 7. Discussion Reply → question author: a reply by someone else to my question.
  const reply = db
    .select({
      reply: comments,
      parent,
      lesson: lessons,
      course: courses,
      actor: users,
    })
    .from(comments)
    .innerJoin(parent, eq(parent.id, comments.parentId))
    .innerJoin(users, eq(users.id, comments.userId))
    .innerJoin(lessons, eq(lessons.id, comments.lessonId))
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, modules.courseId))
    .where(
      and(
        eq(parent.userId, me.id),
        ne(comments.userId, me.id),
        isNull(comments.deletedAt)
      )
    )
    .orderBy(desc(comments.createdAt))
    .get();
  if (reply)
    samples.push({
      kind: "discussion-reply",
      actor: reply.actor,
      data: {
        courseTitle: reply.course.title,
        lessonTitle: reply.lesson.title,
        snippet: reply.reply.body.slice(0, 160),
        url: lessonUrl(reply.course.slug, reply.lesson.id, reply.reply.id),
        occurredAt: reply.reply.createdAt,
      },
    });

  // 6. Discussion Question → Instructor: a question on my course, not by me.
  const question = db
    .select({ q: comments, lesson: lessons, course: courses, actor: asker })
    .from(comments)
    .innerJoin(asker, eq(asker.id, comments.userId))
    .innerJoin(lessons, eq(lessons.id, comments.lessonId))
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, modules.courseId))
    .where(
      and(
        eq(courses.instructorId, me.id),
        isNull(comments.parentId),
        isNull(comments.deletedAt),
        ne(comments.userId, me.id)
      )
    )
    .orderBy(desc(comments.createdAt))
    .get();
  if (question)
    samples.push({
      kind: "discussion-question",
      actor: question.actor,
      data: {
        courseTitle: question.course.title,
        lessonTitle: question.lesson.title,
        snippet: question.q.body.slice(0, 160),
        url: lessonUrl(question.course.slug, question.lesson.id, question.q.id),
        occurredAt: question.q.createdAt,
      },
    });

  // 5. New Enrollment → Instructor (off by default; seeded so it can be judged).
  const enrollment = db
    .select({
      course: courses,
      actor: users,
      enrolledAt: enrollments.enrolledAt,
    })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .innerJoin(users, eq(users.id, enrollments.userId))
    .where(eq(courses.instructorId, me.id))
    .orderBy(desc(enrollments.enrolledAt))
    .get();
  if (enrollment)
    samples.push({
      kind: "enrollment",
      actor: enrollment.actor,
      data: {
        courseTitle: enrollment.course.title,
        url: `/instructor/${enrollment.course.id}/students`,
        occurredAt: enrollment.enrolledAt,
      },
    });

  // 4. Seat claimed → the Team Admin who owns the Team Licence.
  const seat = db
    .select({ coupon: coupons, course: courses, actor: users })
    .from(coupons)
    .innerJoin(purchases, eq(purchases.id, coupons.purchaseId))
    .innerJoin(courses, eq(courses.id, coupons.courseId))
    .innerJoin(users, eq(users.id, coupons.redeemedByUserId))
    .where(
      and(eq(purchases.userId, me.id), ne(coupons.redeemedByUserId, me.id))
    )
    .orderBy(desc(coupons.redeemedAt))
    .get();
  if (seat) {
    const left = db
      .select({ n: sql<number>`count(*)` })
      .from(coupons)
      .where(
        and(
          eq(coupons.purchaseId, seat.coupon.purchaseId),
          isNull(coupons.redeemedByUserId),
          isNull(coupons.refundedAt)
        )
      )
      .get()!.n;
    samples.push({
      kind: "seat-claimed",
      actor: seat.actor,
      data: {
        courseTitle: seat.course.title,
        seatsLeft: left,
        url: "/team",
        occurredAt: seat.coupon.redeemedAt,
      },
    });
  }

  // 3. New Open Refund Request → every Platform Admin.
  if (me.role === UserRole.Admin) {
    const open = db
      .select({
        refund: refunds,
        purchase: purchases,
        course: courses,
        actor: users,
      })
      .from(refunds)
      .innerJoin(purchases, eq(purchases.id, refunds.purchaseId))
      .innerJoin(courses, eq(courses.id, purchases.courseId))
      .innerJoin(users, eq(users.id, purchases.userId))
      .where(eq(refunds.status, RefundStatus.Open))
      .orderBy(desc(refunds.requestedAt))
      .get();
    if (open)
      samples.push({
        kind: "refund-request-open",
        actor: open.actor,
        data: {
          courseTitle: open.course.title,
          amountCents: open.purchase.amountPaid,
          reason: open.refund.reason,
          url: "/admin/refunds",
          occurredAt: open.refund.requestedAt,
        },
      });
  }

  // 1 + 2. Refund Request approved / declined → the buyer. System-caused.
  for (const status of [RefundStatus.Approved, RefundStatus.Declined]) {
    const decided = db
      .select({ refund: refunds, course: courses })
      .from(refunds)
      .innerJoin(purchases, eq(purchases.id, refunds.purchaseId))
      .innerJoin(courses, eq(courses.id, purchases.courseId))
      .where(and(eq(purchases.userId, me.id), eq(refunds.status, status)))
      .orderBy(desc(refunds.resolvedAt))
      .get();
    if (decided)
      samples.push({
        kind:
          status === RefundStatus.Approved
            ? "refund-approved"
            : "refund-declined",
        actor: null,
        data: {
          courseTitle: decided.course.title,
          note: decided.refund.decisionNote,
          url: `/settings#refund-request-${decided.refund.id}`,
          occurredAt: decided.refund.resolvedAt,
        },
      });
  }

  // Each sample carries `occurredAt`, the real event time, because the seed
  // replays past events; in production the Notification is created at that time.
  // Oldest first, so the feed's newest-first order matches the list above.
  for (const s of samples.reverse()) {
    await knock.workflows.trigger("discussion-reply", {
      recipients: [{ id: String(me.id), name: me.name, email: me.email }],
      actor: s.actor
        ? { id: String(s.actor.id), name: s.actor.name, email: s.actor.email }
        : undefined,
      data: { kind: s.kind, actorName: s.actor?.name ?? null, ...s.data },
    });
  }
  return { seeded: samples.map((s) => s.kind) };
}
