// PROTOTYPE, throwaway (#38): "What do Notification emails look like?"
// Three variants of the Notification email, switchable via ?variant=A|B|C, each
// shown for a declined Refund Request and a Discussion Reply (?sample=0|1),
// inside a fake inbox. "Send via Knock" triggers the real email through Knock's
// built-in test email channel so it can be judged in a real inbox.
import { useState } from "react";
import { Form, useActionData, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/prototype.notification-emails";
import { PrototypeSwitcher } from "~/components/prototype-switcher";
import { VARIANTS, type VariantKey } from "~/lib/notification-email-prototype";
import {
  loadSamples,
  renderEmail,
  sendEmail,
} from "~/lib/notification-email-prototype.server";

const KEYS = Object.keys(VARIANTS) as VariantKey[];

function pick(url: URL) {
  const v = url.searchParams.get("variant") as VariantKey;
  const variant = KEYS.includes(v) ? v : "A";
  const sampleIndex = Number(url.searchParams.get("sample") ?? 0);
  return { variant, sampleIndex };
}

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const { variant, sampleIndex } = pick(url);
  const samples = loadSamples(url.origin);
  const sample = samples[sampleIndex] ?? samples[0];
  return {
    variant,
    sampleIndex,
    samples: samples.map((s) => ({ kind: s.kind, recipientName: s.recipientName })),
    email: renderEmail(variant, sample),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const url = new URL(request.url);
  const { variant, sampleIndex } = pick(url);
  const to = String((await request.formData()).get("to") ?? "").trim();
  const sample = loadSamples(url.origin)[sampleIndex];
  try {
    const runId = await sendEmail(variant, sample, to);
    return { ok: true as const, message: `Sent ${variant} / ${sample.kind} to ${to} (workflow run ${runId})` };
  } catch (e) {
    return { ok: false as const, message: String(e) };
  }
}

export default function NotificationEmailsPrototype({ loaderData }: Route.ComponentProps) {
  const { variant, sampleIndex, samples, email } = loaderData;
  const result = useActionData<typeof action>();
  const sending = useNavigation().state === "submitting";
  const [params, setParams] = useSearchParams();
  const [width, setWidth] = useState<600 | 375>(600);
  const [to, setTo] = useState(() =>
    typeof localStorage === "undefined" ? "" : (localStorage.getItem("prototype-email-to") ?? "")
  );

  return (
    <div className="min-h-screen bg-zinc-100 p-6 pb-24 text-zinc-900">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">Notification:</span>
          {samples.map((s, i) => (
            <button
              key={s.kind}
              onClick={() => setParams((p) => (p.set("sample", String(i)), p), { replace: true })}
              className={`rounded-full border px-3 py-1 ${i === sampleIndex ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white"}`}
            >
              {s.kind === "refund-declined" ? "Refund Request declined" : "Discussion Reply"} → {s.recipientName}
            </button>
          ))}
          <span className="ml-4 font-semibold">Width:</span>
          {([600, 375] as const).map((w) => (
            <button
              key={w}
              onClick={() => setWidth(w)}
              className={`rounded-full border px-3 py-1 ${w === width ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white"}`}
            >
              {w === 600 ? "Desktop" : "Phone"}
            </button>
          ))}
        </div>

        {/* Fake inbox row: what you see before opening the email. */}
        <div className="rounded-lg border bg-white">
          <div className="border-b px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Inbox
          </div>
          <div className="flex gap-3 px-4 py-3 text-sm">
            <span className="w-56 shrink-0 truncate font-semibold">{email.from.replace(/ <.*>$/, "")}</span>
            <span className="truncate">
              <span className="font-semibold">{email.subject}</span>
              <span className="text-zinc-500"> – {email.preheader}</span>
            </span>
          </div>
        </div>

        {/* Opened email. */}
        <div className="rounded-lg border bg-white">
          <div className="space-y-1 border-b px-4 py-3 text-sm">
            <div className="text-lg font-semibold">{email.subject}</div>
            <div><span className="text-zinc-500">From:</span> {email.from}</div>
            <div><span className="text-zinc-500">To:</span> {samples[sampleIndex]?.recipientName}</div>
          </div>
          <div className="flex justify-center bg-white">
            <iframe
              title="email"
              srcDoc={email.html}
              style={{ width, height: 760 }}
              className="border-0"
            />
          </div>
        </div>

        <Form method="post" className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3 text-sm">
          <span className="font-semibold">Send this one via Knock to</span>
          <input
            name="to"
            type="email"
            required
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              localStorage.setItem("prototype-email-to", e.target.value);
            }}
            placeholder="a Knock account member's address"
            className="min-w-72 flex-1 rounded border px-2 py-1"
          />
          <button disabled={sending} className="rounded bg-zinc-900 px-3 py-1.5 font-medium text-white disabled:opacity-50">
            {sending ? "Sending…" : "Send"}
          </button>
          {result && (
            <span className={`w-full ${result.ok ? "text-green-700" : "text-red-700"}`}>{result.message}</span>
          )}
          <span className="w-full text-xs text-zinc-500">
            The Knock test channel sends from Knock's own address, so the From line above is what production would show, not what arrives.
          </span>
        </Form>
      </div>
      <PrototypeSwitcher
        variants={KEYS.map((key) => ({ key, name: VARIANTS[key].name }))}
        current={variant}
      />
    </div>
  );
}
