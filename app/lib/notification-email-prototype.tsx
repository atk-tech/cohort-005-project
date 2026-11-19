// PROTOTYPE, throwaway (#38). Three structurally different Notification email
// variants, each covering a declined Refund Request and a Discussion Reply.
// Inline styles only, because email clients drop <style> and classes.
import type { CSSProperties, ReactNode } from "react";

export type EmailSample =
  | {
      kind: "refund-declined";
      recipientName: string;
      courseTitle: string;
      amountCents: number;
      purchasedAt: string;
      reason: string;
      note: string;
      decidedAt: string;
      url: string;
      courseUrl: string;
      settingsUrl: string;
    }
  | {
      kind: "discussion-reply";
      recipientName: string;
      actorName: string;
      courseTitle: string;
      lessonTitle: string;
      question: string;
      reply: string;
      repliedAt: string;
      url: string;
      settingsUrl: string;
    };

type Built = {
  subject: string;
  from: string;
  preheader: string;
  Body: () => ReactNode;
};

// The production From address needs a verified Resend subdomain (#36); this
// domain is a placeholder. The Knock test channel always sends from Knock's own address.
const DOMAIN = "mail.cadence.example";

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100
  );
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const firstName = (name: string) => name.split(" ")[0];
const snippet = (text: string, n: number) =>
  text.length > n ? text.slice(0, n).trimEnd() + "…" : text;

const font =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const ink = "#171717";
const muted = "#737373";
const line = "#e5e5e5";

// ─── A: Branded card ─────────────────────────────────────────────────────────
// Grey canvas, Cadence wordmark, white card with a status pill, a facts table,
// the quoted text, one black button, and a footer explaining why you got it.

function CardShell({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <div style={{ background: "#f5f5f5", padding: "32px 16px", fontFamily: font, color: ink }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", padding: "0 4px 16px" }}>
          Cadence
        </div>
        <div style={{ background: "#fff", border: `1px solid ${line}`, borderRadius: 12, padding: 32 }}>
          {children}
        </div>
        <div style={{ fontSize: 12, lineHeight: "18px", color: muted, padding: "16px 4px" }}>
          {footer}
        </div>
      </div>
    </div>
  );
}

const pill = (bg: string, fg: string): CSSProperties => ({
  display: "inline-block",
  background: bg,
  color: fg,
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 999,
  padding: "2px 10px",
  marginBottom: 12,
});
const button: CSSProperties = {
  display: "inline-block",
  background: ink,
  color: "#fff",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 600,
  borderRadius: 8,
  padding: "12px 20px",
};
const quote: CSSProperties = {
  borderLeft: `3px solid ${line}`,
  padding: "4px 0 4px 14px",
  margin: "0 0 24px",
  color: "#404040",
  fontSize: 15,
  lineHeight: "22px",
  whiteSpace: "pre-wrap",
};

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, margin: "0 0 24px" }}>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td style={{ color: muted, padding: "6px 0", borderTop: `1px solid ${line}`, width: 120 }}>{k}</td>
            <td style={{ padding: "6px 0", borderTop: `1px solid ${line}` }}>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function variantA(s: EmailSample): Built {
  const from = `Cadence <notifications@${DOMAIN}>`;
  const footer = (why: string) => (
    <>
      {why} <a href={s.settingsUrl} style={{ color: muted }}>Manage email Notifications</a>
      <br />
      Cadence · Replies to this email aren't read.
    </>
  );
  if (s.kind === "refund-declined")
    return {
      from,
      subject: `Your Refund Request for ${s.courseTitle} was declined`,
      preheader: `A Platform Admin declined it. You keep your access, and you can ask again.`,
      Body: () => (
        <CardShell footer={footer("You're getting this because you asked for a refund on Cadence.")}>
          <span style={pill("#fef2f2", "#b91c1c")}>Declined</span>
          <h1 style={{ fontSize: 22, lineHeight: "28px", margin: "0 0 8px" }}>
            Your Refund Request was declined
          </h1>
          <p style={{ fontSize: 15, lineHeight: "22px", margin: "0 0 24px", color: "#404040" }}>
            Hi {firstName(s.recipientName)}, a Platform Admin looked at your Refund Request for{" "}
            <strong>{s.courseTitle}</strong> and declined it. You keep your access to the course.
          </p>
          <div style={{ fontSize: 12, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            Their note
          </div>
          <p style={quote}>{s.note}</p>
          <Facts
            rows={[
              ["Course", s.courseTitle],
              ["Purchase", `${money(s.amountCents)} on ${day(s.purchasedAt)}`],
              ["Your reason", s.reason],
              ["Decided", day(s.decidedAt)],
            ]}
          />
          <a href={s.url} style={button}>View your Refund Request</a>
          <p style={{ fontSize: 13, color: muted, margin: "20px 0 0" }}>
            You can raise a new Refund Request from the{" "}
            <a href={s.courseUrl} style={{ color: ink }}>course page</a>.
          </p>
        </CardShell>
      ),
    };
  return {
    from,
    subject: `${s.actorName} replied to your question in ${s.lessonTitle}`,
    preheader: snippet(s.reply, 90),
    Body: () => (
      <CardShell footer={footer("You're getting this because you asked this Discussion Question.")}>
        <span style={pill("#eff6ff", "#1d4ed8")}>New reply</span>
        <h1 style={{ fontSize: 22, lineHeight: "28px", margin: "0 0 8px" }}>
          {s.actorName} replied to your question
        </h1>
        <p style={{ fontSize: 14, color: muted, margin: "0 0 24px" }}>
          {s.courseTitle} · {s.lessonTitle}
        </p>
        <div style={{ fontSize: 12, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
          Your question
        </div>
        <p style={{ ...quote, color: muted }}>{snippet(s.question, 200)}</p>
        <div style={{ fontSize: 12, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
          {s.actorName}'s reply
        </div>
        <p style={quote}>{s.reply}</p>
        <a href={s.url} style={button}>Reply in Cadence</a>
      </CardShell>
    ),
  };
}

// ─── B: Plain letter ─────────────────────────────────────────────────────────
// Looks like a person wrote it: no canvas, no wordmark, no button. Short
// paragraphs, the text quoted inline, a plain link, a one-line signature.

function variantB(s: EmailSample): Built {
  const body: CSSProperties = {
    fontFamily: font,
    fontSize: 15,
    lineHeight: "23px",
    color: ink,
    maxWidth: 560,
    padding: "24px 16px",
  };
  const p: CSSProperties = { margin: "0 0 16px" };
  const q: CSSProperties = { margin: "0 0 16px", paddingLeft: 12, borderLeft: `2px solid ${line}`, color: "#404040", whiteSpace: "pre-wrap" };
  const sig = (
    <p style={{ ...p, color: muted, fontSize: 13, marginTop: 32 }}>
      Cadence
      <br />
      Don't want these emails? <a href={s.settingsUrl} style={{ color: muted }}>Change your Notification settings</a>.
    </p>
  );
  if (s.kind === "refund-declined")
    return {
      from: `Cadence <notifications@${DOMAIN}>`,
      subject: `Refund Request declined: ${s.courseTitle}`,
      preheader: `Hi ${firstName(s.recipientName)}, we've looked at your Refund Request and declined it.`,
      Body: () => (
        <div style={body}>
          <p style={p}>Hi {firstName(s.recipientName)},</p>
          <p style={p}>
            We've looked at your Refund Request for {s.courseTitle} ({money(s.amountCents)}, bought{" "}
            {day(s.purchasedAt)}) and declined it. Here's what the Platform Admin wrote:
          </p>
          <p style={q}>{s.note}</p>
          <p style={p}>
            Nothing changes about your Purchase: you still have the course. If you think we got it wrong,
            you can raise a new Refund Request from the course page.
          </p>
          <p style={p}>
            See the Refund Request in Cadence: <a href={s.url} style={{ color: "#1d4ed8" }}>{s.url}</a>
          </p>
          {sig}
        </div>
      ),
    };
  return {
    // The person who caused it is in the From name; the address stays Cadence's.
    from: `${s.actorName} via Cadence <notifications@${DOMAIN}>`,
    subject: `Re: ${snippet(s.question.replace(/\s+/g, " "), 60)}`,
    preheader: snippet(s.reply, 90),
    Body: () => (
      <div style={body}>
        <p style={{ ...p, whiteSpace: "pre-wrap" }}>{s.reply}</p>
        <p style={{ ...p, color: muted, fontSize: 13 }}>
          {s.actorName} replied to your question in{" "}
          <a href={s.url} style={{ color: "#1d4ed8" }}>{s.lessonTitle}</a> ({s.courseTitle}). Reply in Cadence, not to this email.
        </p>
        <p style={{ ...q, color: muted, fontSize: 13 }}>
          You asked: {snippet(s.question, 200)}
        </p>
        {sig}
      </div>
    ),
  };
}

// ─── C: Feed row ─────────────────────────────────────────────────────────────
// The email is the Notification Feed row, as it looks in the app: icon circle,
// bold title, "course · time" meta, the content underneath. Then two links:
// open this item, or open the Notification Feed. Per-type opt-out in the footer.

function FeedShell({
  icon,
  iconBg,
  title,
  meta,
  children,
  openLabel,
  url,
  settingsUrl,
  typeName,
}: {
  icon: string;
  iconBg: string;
  title: ReactNode;
  meta: string;
  children: ReactNode;
  openLabel: string;
  url: string;
  settingsUrl: string;
  typeName: string;
}) {
  const origin = new URL(url).origin;
  return (
    <div style={{ fontFamily: font, color: ink, padding: "24px 16px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", border: `1px solid ${line}`, borderRadius: 8 }}>
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${line}`, fontSize: 13, color: muted }}>
          <strong style={{ color: ink }}>Cadence</strong> · Notification
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#eff6ff" }}>
          <tbody>
            <tr>
              <td style={{ width: 56, verticalAlign: "top", padding: "16px 0 16px 16px" }}>
                <div style={{ width: 36, height: 36, borderRadius: 18, background: iconBg, color: "#fff", fontSize: 16, lineHeight: "36px", textAlign: "center" }}>
                  {icon}
                </div>
              </td>
              <td style={{ padding: 16, fontSize: 14, lineHeight: "21px" }}>
                <div style={{ fontWeight: 600 }}>{title}</div>
                <div style={{ color: muted, fontSize: 13, marginBottom: 10 }}>{meta}</div>
                {children}
              </td>
            </tr>
          </tbody>
        </table>
        <div style={{ padding: 16, borderTop: `1px solid ${line}`, fontSize: 14 }}>
          <a href={url} style={{ color: "#1d4ed8", fontWeight: 600, textDecoration: "none" }}>{openLabel} →</a>
          <span style={{ color: line }}>{"  |  "}</span>
          <a href={`${origin}/notifications`} style={{ color: muted, textDecoration: "none" }}>All Notifications</a>
        </div>
      </div>
      <p style={{ maxWidth: 560, margin: "12px auto 0", fontSize: 12, color: muted }}>
        <a href={settingsUrl} style={{ color: muted }}>Turn off "{typeName}" emails</a> · Sent by Cadence. Replies aren't read.
      </p>
    </div>
  );
}

function variantC(s: EmailSample): Built {
  const from = `Cadence Notifications <no-reply@${DOMAIN}>`;
  const box: CSSProperties = { background: "#fff", border: `1px solid ${line}`, borderRadius: 6, padding: "8px 12px", whiteSpace: "pre-wrap", margin: "0 0 8px" };
  if (s.kind === "refund-declined")
    return {
      from,
      subject: `[Cadence] Refund Request declined · ${s.courseTitle}`,
      preheader: snippet(s.note, 90),
      Body: () => (
        <FeedShell
          icon="✕"
          iconBg="#dc2626"
          title={<>Your Refund Request for {s.courseTitle} was declined</>}
          meta={`${money(s.amountCents)} Purchase on ${day(s.purchasedAt)} · ${day(s.decidedAt)}`}
          openLabel="View Refund Request"
          url={s.url}
          settingsUrl={s.settingsUrl}
          typeName="Refund Request declined"
        >
          <div style={box}>{s.note}</div>
          <div style={{ color: muted, fontSize: 13 }}>You keep the course, and you can ask again from the course page.</div>
        </FeedShell>
      ),
    };
  return {
    from,
    subject: `[Cadence] ${s.actorName} replied · ${s.lessonTitle}`,
    preheader: snippet(s.reply, 90),
    Body: () => (
      <FeedShell
        icon="↩"
        iconBg="#2563eb"
        title={<>{s.actorName} replied to your question</>}
        meta={`${s.courseTitle} · ${s.lessonTitle} · ${day(s.repliedAt)}`}
        openLabel="Open the discussion"
        url={s.url}
        settingsUrl={s.settingsUrl}
        typeName="Discussion Reply"
      >
        <div style={box}>{s.reply}</div>
        <div style={{ color: muted, fontSize: 13 }}>On: “{snippet(s.question, 120)}”</div>
      </FeedShell>
    ),
  };
}

export const VARIANTS = {
  A: { name: "Branded card", build: variantA },
  B: { name: "Plain letter", build: variantB },
  C: { name: "Feed row", build: variantC },
} as const;
export type VariantKey = keyof typeof VARIANTS;
