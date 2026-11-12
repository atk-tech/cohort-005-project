# Notification providers for Cadence: survey

Research for issue #3 ("Which notification providers meet Cadence's needs?"), part of the wayfinder map in issue #1.
This file is facts only. The choice is made in a later ticket.

- All sources were accessed on **2026-11-12** unless noted otherwise.
- **Unverified** means the primary source did not say, or the page could not be read (for example, a JavaScript-only trust centre). It does not mean the feature is missing.
- **GDPR filter (from map #1):** the provider must offer a DPA **and** host data in the EU, or be self-hostable. Transfers that rely on SCCs alone fail the filter.
- **BYO delivery providers:** every provider surveyed here sends email and push through delivery providers the customer configures (Postmark, SES, SendGrid, APNs, FCM and so on). The in-app feed is stored by the notification provider. Where email and push data is hosted therefore depends partly on which delivery providers Cadence configures, not only on the notification provider's own sub-processor list.

## Summary: GDPR filter

| Provider | DPA | EU hosting | Self-hostable | Passes filter? | Notes |
| --- | --- | --- | --- | --- | --- |
| Knock | Yes (SCCs) | **No**. "Expected by end of 2026" | No | **No (today)** | All 19 listed sub-processors are in the USA. |
| Novu | Yes (Cloud only) | Yes: Frankfurt, chosen at sign-up, also on the Free plan | Yes: MIT core, Docker | **Yes** | Cloud sub-processor list unverified. The community self-hosted edition has no DPA, because you are the operator. |
| MagicBell | Stated ("we provide data processing agreements") | **Not found** | No | **No (unverified EU hosting)** | No hosting region or sub-processor list published. |
| Courier | Yes (in the ToS; pricing lists the DPA under Enterprise) | Yes: EU datacenter (Ireland), Business and Enterprise plans only | No | **Yes, on a paid plan** | Some sub-processors are USA-only (Sentry, HubSpot, Twilio, dbt, Stripe, WorkOS). The DPA text still says the infrastructure "is located in the United States". |
| SuprSend | Yes (DPF plus SCCs) | Yes: workspace region US or EU | Yes, Enterprise licence only (also BYOC, beta) | **Yes** (EU on the Free plan unverified) | Support staff in India may access data. Sub-processor page blocked (HTTP 403), so unverified. |
| Pingram (formerly NotificationAPI) | Unverified | Yes: Frankfurt, all plans | No | **Unverified** (no DPA found) | The product now focuses on SMS, email and calls. In-app docs return 404. |
| Notifo (open source) | n/a when self-hosted | Self-host anywhere | Yes: MIT, .NET | **Yes (self-hosted)** | Small project. Last tagged release was in 2022. |

## Per-provider details

### Knock

- **GDPR**
  - DPA: yes, between Knock Labs, Inc. (New York) and the customer. EU transfers use SCCs Module 2/3 under Irish law. The DPA does not mention the EU–US Data Privacy Framework (DPF) or an EU region. [DPA](https://knock.app/legal/data-processing-addendum)
  - EU hosting: none today. The security page says: "We expect to support EU data residency by the end of 2026." [Security](https://docs.knock.app/security)
  - Certifications: "SOC 2 Type 2 compliant, GDPR certified, CCPA, and HIPAA compliant." [Security](https://docs.knock.app/security)
  - Sub-processors: all 19 are listed as **USA**, including AWS (hosting), ClickHouse, Cloudflare, Datadog, Sentry, Segment, PostHog, OpenAI, Anthropic and Postmark ("Application Email Service"). The page shows no last-updated date. [Sub-processors](https://knock.app/legal/subprocessors)
- **In-app feed**
  - `@knocklabs/react` provides prebuilt `NotificationFeed`, `NotificationFeedPopover`, `NotificationIconButton` and toasts, plus headless hooks. [React overview](https://docs.knock.app/in-app-ui/react/overview.md)
  - Real-time updates over WebSocket (`new-message` events, which may be throttled). [In-app API](https://docs.knock.app/in-app-ui/api-overview.md)
  - States: seen (`seen_at`), read (`read_at`), interacted/clicked (`link_clicked_at`) and archived (`archived_at`). [In-app API](https://docs.knock.app/in-app-ui/api-overview.md)
  - Client authentication uses a public API key plus an optional "enhanced security mode" that signs requests per user. [In-app API](https://docs.knock.app/in-app-ui/api-overview.md)
- **Other channels**
  - Email: BYO provider.
  - Mobile push: APNs, FCM, Expo, OneSignal and Amazon SNS. [Push overview](https://docs.knock.app/integrations/push/overview.md)
  - Web push: there is no native channel on the push overview page. A tutorial covers web push through FCM. [FCM web push tutorial](https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm.md)
- **Workflows**
  - Batch function (digest-like): fixed or sliding windows, 2–1000 items. [Batch](https://docs.knock.app/designing-workflows/batch-function.md)
  - Delay function. [Delay](https://docs.knock.app/designing-workflows/delay-function.md) (details not read)
  - Recurring schedules API. [Schedules](https://docs.knock.app/concepts/schedules.md)
- **Server integration**
  - Node SDK (`@knocklabs/node`, per the SDK list). [SDKs](https://docs.knock.app/developer-tools/sdks.md)
  - Users are synced with `PUT /v1/users/{id}`, bulk identify, or inline identification inside a workflow trigger. [Identifying recipients](https://docs.knock.app/managing-recipients/identifying-recipients.md)
  - Fit with a React Router v7 server: workflows are triggered by plain server-side API calls. The docs describe no framework-specific adapter, and none is needed.
- **Testing and local development**
  - Development and Production environments, with separate data and API keys. [Environments](https://docs.knock.app/version-control/environments.md)
  - The test runner has `sandbox_mode`, which "generates and previews the messages without delivering them", and `skip_delay`. Both are settable through the API. [Testing workflows](https://docs.knock.app/send-notifications/testing-workflows.md)
  - There is no documented local emulator.
  - The docs give no guidance on stubbing Knock in tests (unverified).
- **Pricing**
  - Free: $0, 10,000 messages per month.
  - Starter: $250 per month, 50,000 messages, then $0.005 each.
  - Enterprise: custom. Adds "Dedicated infrastructure" and SAML SSO.
  - [Pricing](https://knock.app/pricing)
- **Maturity and licence**
  - The platform is proprietary SaaS.
  - The client SDK repo `knocklabs/javascript` is MIT and was active on 2026-11-12. [GitHub](https://github.com/knocklabs/javascript)

### Novu

- **GDPR**
  - EU region in **Frankfurt, Germany**, chosen when the account is created. "we cannot copy or move data between data warehouses in different regions." [Security](https://docs.novu.co/platform/additional-resources/security.md)
  - EU endpoints: `eu.api.novu.co` and `wss://eu.socket.novu.co`. [Security](https://docs.novu.co/platform/additional-resources/security.md)
  - The pricing page lists "US + EU data residency" on the Free plan. [Pricing](https://novu.co/pricing)
  - DPA: Novu Cloud customers can download it. The contracting party is Noti-Fire Apps Ltd. d/b/a Novu (an Israeli company). The DPA requires SCCs for transfers to non-adequate countries, does not name an EU region, and is governed by Irish law. [DPA](https://novu.co/dpa), [Security](https://docs.novu.co/platform/additional-resources/security.md)
  - The privacy policy says transfers to Israel rely on the EU adequacy decision. [Privacy](https://novu.co/privacy)
  - Certifications: SOC 2 Type II, ISO 27001, HIPAA (BAA). [Security](https://docs.novu.co/platform/additional-resources/security.md)
  - Sub-processors: **unverified**. The DPA refers to sub-processors "as identified to Controller". The privacy policy names categories only, and the trust centre (trust.novu.co) does not render without JavaScript.
  - Self-hosting: the community edition lists "Data Processing Agreements" and SOC 2/ISO as Cloud-only. You are the operator, so GDPR "depends on infrastructure". [Self-hosted vs Cloud](https://docs.novu.co/community/self-hosted-and-novu-cloud.md)
- **In-app feed**
  - `@novu/react` and `@novu/js` provide a prebuilt `<Inbox />` (Bell, Notifications, Preferences) and headless hooks. [Inbox overview](https://docs.novu.co/platform/inbox/overview.md)
  - Real-time updates through a WebSocket service (`ws` service, `wss://…socket.novu.co`).
  - States: read and unread. Snooze is Cloud-only. Seen and archived are not mentioned on the overview page (unverified).
  - User authentication uses an HMAC `subscriberHash`. [Inbox overview](https://docs.novu.co/platform/inbox/overview.md)
- **Other channels:** email, push and more, all through BYO providers. Web push is unverified.
- **Workflows**
  - Delay: fixed, scheduled (until a time in the subscriber's time zone) or dynamic (from the payload). [Delay](https://docs.novu.co/platform/workflow/add-and-configure-steps/configure-action-steps/delay.md)
  - Digest step and throttle step. [Digest](https://docs.novu.co/.mintlify/skills/dashboard-workflows/references/digest-step.md), [Throttle](https://docs.novu.co/.mintlify/skills/dashboard-workflows/references/throttle-step.md)
  - Cron-style scheduled triggers: unverified.
- **Server integration**
  - Node SDK `@novu/api`. Triggers name a subscriber ID in `to`. [Installation](https://docs.novu.co/.mintlify/skills/trigger-notification/references/installation.md)
  - Code-first workflows (`@novu/framework`) need a "bridge" HTTP endpoint in your app.
  - The framework ships adapters for Express, h3, Hono, Lambda, Nest, Next, Nuxt, **Remix** and SvelteKit. There is no adapter named React Router. [GitHub servers dir](https://github.com/novuhq/novu/tree/next/packages/framework/src/servers)
  - Dashboard-built workflows need no bridge.
- **Testing and local development**
  - `npx novu@latest dev` starts a local Studio and tunnels to your bridge. There is a `--headless` mode for CI.
  - Development and Production have separate secret keys. [Studio and CLI](https://docs.novu.co/.mintlify/skills/framework-integration/references/studio-and-cli.md)
  - The whole stack can also run locally through Docker Compose: api, worker, ws, dashboard, MongoDB, Redis, and S3-compatible storage. [Docker](https://docs.novu.co/community/self-hosting-novu/deploy-with-docker.md)
- **Pricing**
  - Free: $0, 10,000 workflow runs per month, 24-hour activity retention, 5 workflows.
  - Pro: from $30 for 30,000 runs.
  - Team: from $250.
  - Overage is $1.20 per 1,000 runs.
  - Self-hosted deployment options are listed under Enterprise.
  - [Pricing](https://novu.co/pricing)
- **Maturity and licence**
  - The core is MIT. The `enterprise/` folder is under a commercial licence. [GitHub](https://github.com/novuhq/novu)
  - 40.3k stars. The latest `@novu/framework` release is v2.14.0 (2026-09-28).
  - The community self-hosted edition lacks custom environments, SSO/RBAC, branding removal and email activity tracking, and allows only 1 team member. [Self-hosted vs Cloud](https://docs.novu.co/community/self-hosted-and-novu-cloud.md)

### MagicBell

- **GDPR**
  - The trust centre states "We provide data processing agreements", "fully compliant with GDPR", and AES-256 encryption at rest. [Security](https://www.magicbell.com/security)
  - It names no hosting provider or region, no EU residency, no SCCs and no SOC 2.
  - The privacy policy (MagicBell, Inc., San Francisco, updated 2024-07-02) names only analytics and marketing processors (Google Ireland, Mixpanel US, Segment US, X Corp US). [Privacy](https://www.magicbell.com/privacy-policy)
  - EU hosting: **not found (unverified)**.
  - Sub-processor list: **not published (unverified)**.
- **In-app feed**
  - `@magicbell/react` provides `FloatingInbox`, `Inbox`, `InlineNotification`, `ToastContainer`, `UserPreferences` and `WebPushButton`.
  - Read and unread states are supported.
  - Seen and archived states and headless hooks: unverified.
  - User authentication: you need a "User JWT", generated on your own server. [React](https://www.magicbell.com/docs/libraries/magicbell-react)
  - A Realtime section exists in the JS client docs (mechanism unverified). [JS](https://www.magicbell.com/docs/libraries/magicbell-js)
- **Other channels:** email (SES, Mailgun, SendGrid, SMTP), web push, APNs, FCM, Expo, Slack, Teams and SMS. [Docs](https://www.magicbell.com/docs)
- **Workflows**
  - `wait` (delay) and conditional steps.
  - Digest and batching are not mentioned.
  - There is no native scheduler: "scheduled jobs" means your own app triggers the workflow. [Workflows](https://www.magicbell.com/workflows)
- **Server integration**
  - `magicbell-js` (project client). Users are synced with `users.saveUser`. Notifications are sent through broadcasts. [JS](https://www.magicbell.com/docs/libraries/magicbell-js)
- **Testing and local development:** projects exist, but there are no documented environments or sandbox (unverified).
- **Pricing**
  - Builder: $0, 1,000 deliveries per month.
  - Startup: $249 for 50,000, then $0.0025 each.
  - Enterprise: custom.
  - [Pricing](https://www.magicbell.com/pricing)
- **Maturity and licence**
  - The platform is proprietary.
  - The `magicbell/magicbell-js` repo has no SPDX licence detected by GitHub.

### Courier

- **GDPR**
  - Two separate datacenters, US and **EU (Ireland)**, with no shared data. EU endpoints: `api.eu.courier.com`, `inbox.eu.courier.io` and `wss://realtime.eu.courier.io`. Available on **Business and Enterprise** plans. [EU datacenter](https://www.courier.com/docs/platform/workspaces/eu-datacenter.md)
  - Runs on AWS. "Your data stays in the datacenter you send it through, US or EU." [Security](https://www.courier.com/docs/workspaces/security.md)
  - DPA: part of the Terms of Service, with no signature needed. It uses SCCs Module 2 and does not mention the DPF.
  - Schedule 2 §8 of the DPA still says the infrastructure "is located in the United States", and the DPA does not mention the EU datacenter.
  - Sub-processor changes: customers are notified and may object within 7 days. The DPA was updated 2026-09-12. [DPA](https://www.courier.com/data-processing-addendum)
  - The pricing page lists "MSA, DPA, BAA & legal review" under Enterprise. [Pricing](https://www.courier.com/pricing)
  - Sub-processors (updated 2026-08-03): [Sub-processors](https://www.courier.com/subprocessors)
    - **USA & EU:** AWS, ClickHouse, Cloudflare, Datadog, DragonflyDB, Snowflake, Vercel, Anthropic (optional) and OpenAI (optional).
    - **USA only:** dbt, HubSpot, Sentry (application monitoring), Stripe, Twilio ("Analytics") and WorkOS (optional, SSO).
- **In-app feed**
  - `@trycourier/courier-react` (React 18+) provides `<CourierInbox />`, `<CourierInboxPopupMenu />`, `<CourierToast />` and `<CourierPreferences />`. The `useCourier()` hook supports headless use.
  - Authentication: a JWT signed by your backend. [React SDK](https://www.courier.com/docs/sdk-libraries/courier-react-web.md)
  - Real-time updates through a socket. States: read, opened and archived, synced across devices. [Inbox behaviour](https://www.courier.com/docs/in-app/how-the-inbox-behaves.md)
- **Other channels**
  - Email and push through BYO providers.
  - Mobile push: APNs and FCM.
  - Web push: there is no dedicated page. Pusher Beams has a web mode.
  - [Push overview](https://www.courier.com/docs/integrations/push/overview.md)
- **Workflows**
  - Journeys and Automations provide delays. [Onboarding sequence](https://www.courier.com/docs/guides/build-an-onboarding-sequence.md)
  - Digests with schedules. [Daily digest](https://www.courier.com/docs/guides/send-a-daily-digest.md)
  - Batch nodes are mentioned in the Novu migration guide.
  - Throttle: unverified.
- **Server integration**
  - Node SDK. The `baseURL` option selects the EU datacenter. [Node SDK](https://www.courier.com/docs/sdk-libraries/node.md)
  - Users are synced through the user profiles API or an import. [Import users](https://www.courier.com/docs/guides/import-your-users.md)
- **Testing and local development**
  - Test and Production environments, each with its own keys, templates and logs. The docs suggest sandbox provider keys in the Test configuration. [Go live](https://www.courier.com/docs/guides/go-live.md)
  - There is no local emulator.
- **Pricing**
  - Developer: free, 10,000 sends per month (one send is one template to one recipient).
  - Business: $0.005 per send, pay-as-you-go, includes EU data residency.
  - Enterprise: custom.
  - [Pricing](https://www.courier.com/pricing)
- **Maturity and licence**
  - The platform is proprietary.
  - The web SDK repo `trycourier/courier-web` is MIT.

### SuprSend

- **GDPR**
  - DPA: the contracting party is SuprStack Inc (Delaware). [DPA](https://www.suprsend.com/data-processing-addendum)
    - "Customer Personal Data is stored in the hosting region of your workspace, the United States or the European Union."
    - Infrastructure runs on AWS, GCP and Azure in the US and EU.
    - Engineering and support staff in **India** may access data.
    - Transfers use the DPF first, with SCCs as the fallback.
  - The enterprise page states: "US or EU data residency" for SaaS. [Enterprise](https://www.suprsend.com/enterprise)
  - The pricing page lists "Custom Data Center Region" under Enterprise. Whether the EU region is available on Free or Essentials is **unverified**. [Pricing](https://www.suprsend.com/pricing)
  - Certifications: SOC 2 Type II, ISO 27001. [Security](https://docs.suprsend.com/docs/security.md)
  - Sub-processors: listed at trust.suprsend.com/subprocessors, which returned **HTTP 403** (unverified).
  - Self-hosting (Kubernetes, PostgreSQL, ClickHouse, Redis, NATS, optional OpenSearch) requires an **Enterprise licence**. BYOC (beta) is also offered. [Self-hosted](https://docs.suprsend.com/docs/self-hosted/introduction.md)
- **In-app feed**
  - `@suprsend/react` provides a drop-in `Inbox` popover plus full-screen and side-sheet layouts. Toasts are not included. The `Inbox` has a socket connection (`socketHost` option). [React in-app feed](https://docs.suprsend.com/docs/react-in-app-feed.md)
  - Headless hooks. [Headless feed](https://docs.suprsend.com/docs/react-sdk-headless-feed.md)
  - States: seen, read and archived (bulk update API). Clicked is tracked in message logs.
  - Authentication: a public key plus signed user JWT. [Client auth](https://docs.suprsend.com/docs/client-authentication.md)
- **Other channels:** email, SMS, WhatsApp, mobile push, web push, Slack and Teams. [What is SuprSend](https://docs.suprsend.com/docs/what-is-suprsend)
- **Workflows**
  - Delay, digest, batch and time-window nodes. [Delay](https://docs.suprsend.com/reference/workflow-nodes/delay.md), [Digest](https://docs.suprsend.com/reference/workflow-nodes/digest.md), [Batch](https://docs.suprsend.com/reference/workflow-nodes/batch.md)
  - Batching and digest are on the **Business** plan ($250) and above. [Pricing](https://www.suprsend.com/pricing)
- **Server integration**
  - Node SDK. [Node SDK](https://docs.suprsend.com/docs/integrate-node-sdk.md)
  - Users are identified by a distinct ID.
- **Testing and local development**
  - Every account has Sandbox, Staging and Production workspaces "which share no data".
  - Test Mode (Staging only) delivers only to designated internal testers. Blocking currently covers email, SMS and WhatsApp. [Test mode](https://docs.suprsend.com/docs/developer/test-mode.md)
- **Pricing**
  - Free: 10,000 notifications per month, with in-app branding.
  - Essentials: $100 for 50,000.
  - Business: $250 for 50,000. Adds digest, batching and preferences.
  - Enterprise: custom. Adds self-hosting and SAML SSO.
  - [Pricing](https://www.suprsend.com/pricing)
- **Maturity and licence:** the platform is proprietary. The client SDKs are MIT (for example `suprsend/suprsend-web-sdk`).

### Other candidates

**Pingram (formerly NotificationAPI)**
- `notificationapi.com` redirects to `pingram.io`.
- EU region in **Frankfurt**, "available to all users without any additional charges". API base `api.eu.pingram.io`. Post dated 2025-01-23. [EU region](https://www.pingram.io/blog/introducing-notificationapi-s-european-data-center)
- The pricing page lists US, EU and CA regions on all plans. The free tier is 3,000 emails, 100 SMS and 100 call minutes per month. It does not mention in-app or a DPA. [Pricing](https://www.pingram.io/pricing)
- The in-app docs page `pingram.io/docs/channels/inapp` returned **404**. A search snippet mentions the `@notificationapi/react` `NotificationPopup` component (unverified).
- DPA and sub-processors: not found (unverified).

**Notifo (open source, self-hosted)**
- Licence: MIT. Stack: ASP.NET Core / .NET 10, with MongoDB or MySQL/PostgreSQL/SQL Server; Redis optional. Deployment: Docker Compose.
- Channels: real-time in-app through SignalR/WebSockets with an embeddable JS overlay, web push (VAPID), Firebase mobile push, email (SMTP, SES, Mailjet, Mailchimp), and SMS.
- States: seen and confirmed tracking.
- Workflows: delay before sending is configurable. Digests and batching are not mentioned.
- A hosted instance exists at app.notifo.io. Its hosting location and DPA are unverified.
- The README warns that the bundled web-push keys and social logins must be replaced before production. [GitHub](https://github.com/notifo-io/notifo)
- Maturity: 885 stars. Last commit 2026-09-20. Last tag `1.3.0` (2022-11-30).
- There is no React component library. Integration is through the JS SDK.

**Notificare (Netherlands)**
- Notificare B.V. (Amsterdam) offers push and inbox for apps.
- Its privacy policy says: "Notificare has decided to host (parts of) its data in the United States." [Privacy](https://notificare.com/privacy/1)
- It is aimed at mobile and marketing use. It was not surveyed further.

## Cross-cutting observations (facts, not a recommendation)

- **Same pattern everywhere:** all surveyed SaaS providers trigger notifications through a server-side REST/Node SDK call. All of them need a per-user token for the client-side feed:
  - Knock: enhanced security mode.
  - Novu: HMAC `subscriberHash`.
  - Courier, MagicBell and SuprSend: a JWT signed by the backend.
- **What this means for Cadence:** for the DevUI user switch, the React Router loader would mint that token for the currently selected user.
- **Stubbing in tests:** no provider documents a way to stub or mock it in unit tests. The documented options are:
  - Knock: sandbox mode on the API.
  - Courier: a Test environment.
  - SuprSend: Test Mode and a Sandbox workspace.
  - Novu: dev keys or a local Docker stack.
- **Delivery providers:** where email and push data is hosted depends on the delivery providers Cadence configures (BYO), in addition to each provider's own sub-processors.
