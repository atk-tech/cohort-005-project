// PROTOTYPE, throwaway. "What do Notification emails look like?"
// (atk-tech/cohort-005-project#38). Lives on prototype/notification-email only.
//
// Cadence renders each email variant to HTML here and hands Knock the finished
// subject + HTML as workflow data. It reuses the throwaway `test-email` workflow
// from #37: its one Email step (Knock test channel) has the subject `{{ subject }}`
// and the body `{{ html }}` with no layout, so the prototype can flip variants without
// editing templates in the Knock dashboard. Real templates would be Liquid in Knock.
import Knock from "@knocklabs/node";
import { renderToStaticMarkup } from "react-dom/server";
import { and, desc, eq, isNotNull, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "~/db";
import { comments, courses, lessons, modules, purchases, users } from "~/db/schema";
import {
  VARIANTS,
  type EmailSample,
  type VariantKey,
} from "~/lib/notification-email-prototype";

if (!process.env.KNOCK_SECRET_API_KEY) {
  // Vite doesn't put non-VITE_ vars on process.env, so load .env ourselves.
  process.loadEnvFile(".env");
}

export const PROTOTYPE_WORKFLOW = "test-email";

// Two Notifications from the catalogue (#29), filled from real rows where they exist.
export function loadSamples(origin: string): EmailSample[] {
  const samples: EmailSample[] = [];

  // 2. Refund Request declined → buyer. data.db has no Declined Refund Request,
  // so the request and decision note are made up on top of a real Purchase.
  const purchase = db
    .select({ purchase: purchases, course: courses, buyer: users })
    .from(purchases)
    .innerJoin(courses, eq(courses.id, purchases.courseId))
    .innerJoin(users, eq(users.id, purchases.userId))
    .where(ne(purchases.amountPaid, 0))
    .orderBy(desc(purchases.createdAt))
    .get();
  if (purchase)
    samples.push({
      kind: "refund-declined",
      recipientName: purchase.buyer.name,
      courseTitle: purchase.course.title,
      amountCents: purchase.purchase.amountPaid,
      purchasedAt: purchase.purchase.createdAt,
      reason: "The course moves faster than I expected and I can't keep up.",
      note: "You've watched most of the course, which is past our Watch Limit for refunds. If something in the course isn't working for you, reply in the lesson discussion and the Instructor will help.",
      decidedAt: new Date().toISOString(),
      url: `${origin}/settings#refund-request-0`,
      courseUrl: `${origin}/courses/${purchase.course.slug}`,
      settingsUrl: `${origin}/settings#notifications`,
    });

  // 7. Discussion Reply → question author. A real reply by someone else.
  const parent = alias(comments, "parent");
  const author = alias(users, "author");
  const reply = db
    .select({
      reply: comments,
      parent,
      lesson: lessons,
      course: courses,
      actor: users,
      author,
    })
    .from(comments)
    .innerJoin(parent, eq(parent.id, comments.parentId))
    .innerJoin(users, eq(users.id, comments.userId))
    .innerJoin(author, eq(author.id, parent.userId))
    .innerJoin(lessons, eq(lessons.id, comments.lessonId))
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, modules.courseId))
    .where(and(isNotNull(comments.parentId), ne(comments.userId, parent.userId)))
    .orderBy(desc(comments.createdAt))
    .get();
  if (reply)
    samples.push({
      kind: "discussion-reply",
      recipientName: reply.author.name,
      actorName: reply.actor.name,
      courseTitle: reply.course.title,
      lessonTitle: reply.lesson.title,
      question: reply.parent.body,
      reply: reply.reply.body,
      repliedAt: reply.reply.createdAt,
      url: `${origin}/courses/${reply.course.slug}/lessons/${reply.lesson.id}#comment-${reply.reply.id}`,
      settingsUrl: `${origin}/settings#notifications`,
    });

  return samples;
}

export function renderEmail(variant: VariantKey, sample: EmailSample) {
  const v = VARIANTS[variant];
  const { subject, from, preheader, Body } = v.build(sample);
  const html =
    "<!doctype html>" +
    renderToStaticMarkup(
      <html>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{subject}</title>
        </head>
        <body style={{ margin: 0, padding: 0 }}>
          {/* Preheader: the grey preview line after the subject in most inboxes. */}
          <div style={{ display: "none", maxHeight: 0, overflow: "hidden" }}>
            {preheader}
          </div>
          <Body />
        </body>
      </html>
    );
  return { subject, from, preheader, html };
}

export async function sendEmail(
  variant: VariantKey,
  sample: EmailSample,
  to: string
) {
  const knock = new Knock({ apiKey: process.env.KNOCK_SECRET_API_KEY! });
  const { subject, html } = renderEmail(variant, sample);
  const run = await knock.workflows.trigger(PROTOTYPE_WORKFLOW, {
    // A throwaway recipient: the Knock test channel only delivers to Knock
    // account members, so the address is typed in on the page.
    recipients: [{ id: "prototype-email-recipient", name: sample.recipientName, email: to }],
    data: { subject: `[${variant}] ${subject}`, html },
  });
  return run.workflow_run_id;
}
