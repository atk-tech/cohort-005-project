// PROTOTYPE, throwaway (#33). Seeds one of each catalogue Notification into
// the current DevUI user's Knock feed.
import type { Route } from "./+types/api.prototype-seed-notifications";
import { requireUserId } from "~/lib/access.server";
import { seedSampleNotifications } from "~/lib/notification-feed-prototype.server";

export async function action({ request }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  return seedSampleNotifications(userId);
}
