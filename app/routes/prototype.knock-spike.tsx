// PROTOTYPE — throwaway. Answers "Does Knock hold up against Cadence?"
// (atk-tech/cohort-005-project#25). Lives on prototype/knock-spike; never merge.
//
// Server side (secret key): identify the DevUI user, sign their RS256 user
// token, trigger workflows. Browser side (public key + user token only): read
// the feed, mark read/seen, read/write preferences — exactly what our own
// Notification Feed UI would do in production.
import { useCallback, useEffect, useState } from "react";
import { Form, useActionData, useNavigation } from "react-router";
import { and, eq, isNull, ne } from "drizzle-orm";
import type { Route } from "./+types/prototype.knock-spike";
import { requireUserId } from "~/lib/access.server";
import { db } from "~/db";
import { comments, courses, lessons, users } from "~/db/schema";
import { Button } from "~/components/ui/button";

export async function loader({ request }: Route.LoaderArgs) {
  const { identify, signFor, knockUserId, knockPublicConfig } = await import(
    "~/lib/knock-spike.prototype.server"
  );
  const userId = await requireUserId(request);
  const me = db.select().from(users).where(eq(users.id, userId)).get();
  if (!me) throw new Response("Unknown user", { status: 404 });

  await identify(me);
  const token = await signFor(me.id);

  // Real Discussion Questions by someone else, so "reply" targets their author.
  const questions = db
    .select({
      id: comments.id,
      body: comments.body,
      authorId: users.id,
      authorName: users.name,
      lessonTitle: lessons.title,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.userId))
    .innerJoin(lessons, eq(lessons.id, comments.lessonId))
    .where(
      and(
        isNull(comments.parentId),
        isNull(comments.deletedAt),
        ne(comments.userId, me.id)
      )
    )
    .limit(5)
    .all();

  const coursesWithInstructor = db
    .select({
      id: courses.id,
      title: courses.title,
      instructorId: users.id,
      instructorName: users.name,
    })
    .from(courses)
    .innerJoin(users, eq(users.id, courses.instructorId))
    .limit(5)
    .all();

  // Seed every Cadence user into Knock so the "other user" probe and triggers
  // to people who never opened this page both work.
  const everyone = db.select().from(users).all();
  await Promise.all(everyone.map(identify));

  return {
    me: { id: me.id, name: me.name, role: me.role, knockId: knockUserId(me.id) },
    otherKnockId: knockUserId(everyone.find((u) => u.id !== me.id)!.id),
    token,
    ...knockPublicConfig(),
    questions,
    courses: coursesWithInstructor,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { knock, knockUserId } = await import(
    "~/lib/knock-spike.prototype.server"
  );
  const actorId = await requireUserId(request);
  const actor = db.select().from(users).where(eq(users.id, actorId)).get()!;
  const form = await request.formData();
  const intent = form.get("intent");

  try {
    if (intent === "discussion-reply") {
      const authorId = Number(form.get("authorId"));
      const result = await knock.workflows.trigger("discussion-reply", {
        recipients: [knockUserId(authorId)],
        actor: knockUserId(actor.id),
        data: {
          replier_name: actor.name,
          question_id: Number(form.get("questionId")),
          lesson_title: String(form.get("lessonTitle")),
        },
      });
      return { ok: true, intent, recipient: knockUserId(authorId), result };
    }
    if (intent === "new-enrollment") {
      const instructorId = Number(form.get("instructorId"));
      const result = await knock.workflows.trigger("new-enrollment", {
        recipients: [knockUserId(instructorId)],
        actor: knockUserId(actor.id),
        data: {
          student_name: actor.name,
          course_title: String(form.get("courseTitle")),
        },
      });
      return { ok: true, intent, recipient: knockUserId(instructorId), result };
    }
  } catch (error) {
    return {
      ok: false,
      intent,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  return { ok: false, intent, error: "unknown intent" };
}

const KNOCK_API = "https://api.knock.app/v1";

export default function KnockSpike({ loaderData }: Route.ComponentProps) {
  const { me, otherKnockId, token, publicApiKey, feedChannelId } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const [feed, setFeed] = useState<any>(null);
  const [prefs, setPrefs] = useState<any>(null);
  const [log, setLog] = useState<string[]>([]);

  const call = useCallback(
    async (label: string, path: string, init?: RequestInit) => {
      const res = await fetch(`${KNOCK_API}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${publicApiKey}`,
          "X-Knock-User-Token": token,
          "Content-Type": "application/json",
        },
      });
      const body = await res.json().catch(() => null);
      setLog((l) => [`${res.status} ${label}`, ...l].slice(0, 20));
      return { status: res.status, body };
    },
    [publicApiKey, token]
  );

  const refresh = useCallback(async () => {
    const f = await call("GET feed", `/users/${me.knockId}/feeds/${feedChannelId}`);
    setFeed(f.body);
    const p = await call("GET preferences", `/users/${me.knockId}/preferences/default`);
    setPrefs(p.body);
  }, [call, me.knockId, feedChannelId]);

  // Re-run whenever the DevUI switch hands us a new user + token.
  useEffect(() => {
    setFeed(null);
    setPrefs(null);
    refresh();
  }, [refresh]);

  // Triggers are async on Knock's side; poll briefly after one fires.
  useEffect(() => {
    if (!actionData?.ok) return;
    const timers = [1000, 3000, 6000].map((ms) => setTimeout(refresh, ms));
    return () => timers.forEach(clearTimeout);
  }, [actionData, refresh]);

  const markItems = async (status: "read" | "seen" | "unread", ids: string[]) => {
    if (ids.length === 0) return;
    await call(`POST batch/${status} (${ids.length})`, `/messages/batch/${status}`, {
      method: "POST",
      body: JSON.stringify({ message_ids: ids }),
    });
    refresh();
  };

  const setEnrollmentPref = async (on: boolean) => {
    await call(
      `PUT preferences new-enrollment=${on}`,
      `/users/${me.knockId}/preferences/default`,
      {
        method: "PUT",
        body: JSON.stringify({
          __persistence_strategy__: "merge",
          categories: { "new-enrollment": { channel_types: { in_app_feed: on } } },
        }),
      }
    );
    refresh();
  };

  const probeOtherUser = () =>
    call(`GET feed of ${otherKnockId} (expect 403)`, `/users/${otherKnockId}/feeds/${feedChannelId}`);

  const entries: any[] = feed?.entries ?? [];

  return (
    <div className="space-y-6 p-6 font-mono text-sm">
      <div className="rounded border-2 border-dashed border-amber-500 bg-amber-50 p-3 dark:bg-amber-950/30">
        PROTOTYPE — Knock spike. Signed in as <b>{me.name}</b> ({me.role}) →
        Knock id <b>{me.knockId}</b>. Token: <code>{token.slice(0, 24)}…</code>
      </div>

      <section className="space-y-2">
        <h2 className="font-bold">1 · Signed user token</h2>
        <Button size="sm" variant="outline" onClick={probeOtherUser}>
          Try reading {otherKnockId}'s feed with my token
        </Button>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">2 · Trigger Discussion Reply → question author (as {me.name})</h2>
        {loaderData.questions.map((q) => (
          <Form method="post" key={q.id} className="flex items-center gap-2">
            <input type="hidden" name="intent" value="discussion-reply" />
            <input type="hidden" name="authorId" value={q.authorId} />
            <input type="hidden" name="questionId" value={q.id} />
            <input type="hidden" name="lessonTitle" value={q.lessonTitle} />
            <Button size="sm" disabled={navigation.state !== "idle"}>
              Reply
            </Button>
            <span className="truncate">
              to <b>{q.authorName}</b> (user-{q.authorId}) on “{q.lessonTitle}”: {q.body.slice(0, 60)}
            </span>
          </Form>
        ))}
        <h2 className="pt-2 font-bold">4 · Trigger new Enrollment → Instructor (as {me.name})</h2>
        {loaderData.courses.map((c) => (
          <Form method="post" key={c.id} className="flex items-center gap-2">
            <input type="hidden" name="intent" value="new-enrollment" />
            <input type="hidden" name="instructorId" value={c.instructorId} />
            <input type="hidden" name="courseTitle" value={c.title} />
            <Button size="sm" disabled={navigation.state !== "idle"}>
              Enroll
            </Button>
            <span>
              in “{c.title}” → <b>{c.instructorName}</b> (user-{c.instructorId})
            </span>
          </Form>
        ))}
        {actionData && (
          <pre className="overflow-auto rounded bg-muted p-2">
            {JSON.stringify(actionData, null, 2)}
          </pre>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">
          3 · Headless feed — unread {feed?.meta?.unread_count ?? "?"} · unseen{" "}
          {feed?.meta?.unseen_count ?? "?"} · total {feed?.meta?.total_count ?? "?"}
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={refresh}>Refresh</Button>
          <Button size="sm" variant="outline" onClick={() => markItems("seen", entries.filter((e) => !e.seen_at).map((e) => e.id))}>
            Mark all seen
          </Button>
        </div>
        {entries.map((e) => (
          <div key={e.id} className="flex items-center gap-2 border-b py-1">
            <span className="w-28">
              {e.read_at ? "read" : "UNREAD"} / {e.seen_at ? "seen" : "UNSEEN"}
            </span>
            <span className="w-36">{e.source?.key}</span>
            <span className="flex-1 truncate">
              {e.blocks?.[0]?.rendered?.replace(/<[^>]+>/g, "") ?? JSON.stringify(e.data)}
            </span>
            <Button size="xs" variant="outline" onClick={() => markItems(e.read_at ? "unread" : "read", [e.id])}>
              {e.read_at ? "Mark unread" : "Mark read"}
            </Button>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">4 · Preferences (default set, read with user token)</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEnrollmentPref(true)}>
            Opt in to new-enrollment (feed)
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEnrollmentPref(false)}>
            Opt out
          </Button>
        </div>
        <pre className="overflow-auto rounded bg-muted p-2">{JSON.stringify(prefs, null, 2)}</pre>
      </section>

      <section>
        <h2 className="font-bold">Request log (browser → Knock)</h2>
        <pre className="rounded bg-muted p-2">{log.join("\n")}</pre>
      </section>
    </div>
  );
}
