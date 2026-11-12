## Language

- **Conversation with the user: German.** All questions, explanations, recommendations and summaries in the chat are written in German.
- **Technical terms stay in English.** Do not translate established IT or domain terms (e.g. Branch, Commit, Ticket, Notification, Feed, Channel, Grilling, Wayfinder). Only the descriptive text around them is German.
- **Everything persisted is written in English.** This includes:
  - GitHub issues, ticket comments and ticket updates
  - `GLOSSARY.md`
  - ADRs
  - Commit messages and PR descriptions
  - Code, code comments and other docs in the repo
- If unsure whether something is conversation or a persisted artifact: if it ends up in the repo or on GitHub, write it in English.

## Verification checks

Do these checks in this order before you report a change to `app/` as complete:

1. `npm run typecheck`
2. `npm run test`

## When something breaks

| Symptom                                         | Cause                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 401 "Select a user from the DevUI panel"        | No user in the session — switch users and country in the floating panel (`app/components/dev-ui.tsx`). |
| `tsc` reports every `./+types/*` import missing | Typegen has not run. Use `npm run typecheck`, which runs `react-router typegen` first.                 |

## Agent skills

### Issue tracker

Issues and PRDs live as GitHub issues on your own copy of this repo (the `origin` remote), never on `ai-hero-dev/cohort-005-project`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.
