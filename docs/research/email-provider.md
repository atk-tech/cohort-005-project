# Which email provider do we connect to Knock?

Research for [#36](https://github.com/atk-tech/cohort-005-project/issues/36), child of the map [#26](https://github.com/atk-tech/cohort-005-project/issues/26). Sources are Knock's docs and the providers' own docs and pricing pages, read on 2026-11-13. Prices change, so re-check them before signing up.

Inputs: email is in v1, sent immediately with full content ([#32](https://github.com/atk-tech/cohort-005-project/issues/32)). The map asks for hosted services only, as few sign-ups as possible, and a free tier usable in development.

## Recommendation: Knock's built-in test channel for development, Resend for production

- **Development needs no new sign-up.** Every Knock account comes with a built-in "Knock (testing only)" email channel. It is enabled in every environment with no configuration, sends from a Knock-owned address, and allows 100 emails a month to the email addresses of Knock account members [2][1]. That covers the #37 goal of "a test email triggered through Knock reaches an inbox".
- **Production uses Resend.** Knock supports it as a first-class email channel with delivery and bounce webhooks [3]. Its free plan (3,000 emails/month, 100/day) is the most generous of the candidates and does not expire [4]. Pro costs $20/month for 50,000 emails [4], which is far more than Cadence is likely to need.
- **Why not the others.** Postmark's free plan is 100 emails/month with no overage [7], and paid plans start at $15/month for 10,000. Amazon SES needs an AWS account and works off time-limited credits [8]. SendGrid only advertises a free *trial* [9]. None of them beats Resend on the "free dev tier, few sign-ups" criteria.

Knock channels are configured per environment, and provider credentials are not copied between environments [10]. So Development can keep the Knock test channel (or point at Resend) while Production uses Resend. Not confirmed in the docs read: whether a workflow's email step can point at different channels in different environments. If it can't, the Resend channel has to be set up in Development too (option 2 under "Development options" below) before the workflow is promoted.

## Knock's email support

Knock's email overview lists these providers [1]: Knock (testing only), Amazon SES, Cloudflare Email, MailerSend, Mailgun, Mailjet, Mailtrap, Mandrill, Postmark, Resend, SendGrid, SMTP, SparkPost. The overview also offers a sandbox mode for testing email steps without sending an actual email [1].

### Knock (testing only) [2]

- "Enabled and ready to use across all environments with no additional configuration required."
- Limited to "100 emails per month". After that, messages are marked `undelivered` until the next month.
- Only sends "to email addresses associated with the members of your Knock account". Other recipients fail with `knock_recipient_not_allowed`.
- The from address is read-only. No domain is needed.
- "For testing purposes only and is not intended for production use."

### Resend in Knock [3]

- Create a Resend channel under **Channels and sources** in Knock, then configure it per environment.
- Required: the Resend **API key** and a **From email address**. Sending requires a verified domain, or Resend returns `Identity not found`.
- Optional: an incoming webhook so Knock updates message status to `delivered` / `bounced` from Resend events; sandbox mode; open and link tracking; CSS inlining; from/to/cc/bcc/reply-to and payload overrides.
- Recipients need an `email` property.

## Resend facts

| | Free | Pro |
|---|---|---|
| Price | $0 | $20/month [4] |
| Emails | 3,000/month, 100/day [4] | 50,000/month [4] |
| Domains | 3 [4] | |
| Data retention | 30 days [4] | |

### Sending without a domain [5][6]

- Without a verified domain you can only send from the shared `resend.dev` test domain (`onboarding@resend.dev`), and only to the email address of your own Resend account. Anything else returns 403 "You can only send testing emails to your own email address" [5].
- Test recipients `delivered@resend.dev`, `bounced@resend.dev`, `complained@resend.dev` and `suppressed@resend.dev` simulate events without reaching a real inbox. They count against the quota [6].

### Production requirements [11]

- Add and verify a domain. Resend recommends a subdomain such as `notifications.example.com`.
- Add the SPF and DKIM records Resend generates (TXT plus MX or CNAME). Do not proxy CNAMEs through Cloudflare.
- DMARC is not needed for verification but is recommended afterwards.

## Development options

1. **Knock test channel (recommended for now).** No sign-up, no domain. Up to 100 emails/month to Knock account members [2].
2. **Resend without a domain.** One extra sign-up. Sends from `onboarding@resend.dev` to the Resend account owner only [5], or to the `*@resend.dev` test recipients [6]. Useful for exercising the same channel and webhook path that production will use.

Production needs a domain Cadence controls in either case.

## Other candidates

| | Free tier | First paid tier | Notes |
|---|---|---|---|
| Postmark | 100 emails/month, never expires, no overage [7] | $15/month for 10,000 [7] | |
| Amazon SES | Up to $200 AWS credits for new accounts, free plan lasts 6 months [8] | $0.10 per 1,000 emails, à la carte [8] | Needs an AWS account and IAM setup |
| SendGrid | "Free trial", no permanent free plan advertised [9] | Not shown on the product page [9] | |

## Sources

1. Knock, Email overview: https://docs.knock.app/integrations/email/overview
2. Knock, Knock test email channel: https://docs.knock.app/integrations/email/knock-test
3. Knock, Resend: https://docs.knock.app/integrations/email/resend
4. Resend, Pricing: https://resend.com/pricing
5. Resend, 403 error resend dev domain: https://resend.com/docs/knowledge-base/403-error-resend-dev-domain
6. Resend, Send test emails: https://resend.com/docs/dashboard/emails/send-test-emails
7. Postmark, Pricing: https://postmarkapp.com/pricing
8. AWS, Amazon SES pricing: https://aws.amazon.com/ses/pricing/
9. Twilio SendGrid product page: https://www.twilio.com/en-us/sendgrid
10. Knock, Environments: https://docs.knock.app/concepts/environments
11. Resend, Add a domain: https://resend.com/docs/add-a-domain and Domains: https://resend.com/docs/dashboard/domains/introduction
