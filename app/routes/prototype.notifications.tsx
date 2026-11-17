// PROTOTYPE, throwaway (#33). The page behind Variant C ("Inbox page") and
// Variant D ("Bell + overview page").
import {
  useFeed,
  VariantCInboxPage,
  VariantDOverviewPage,
} from "~/components/notification-feed-prototype";

export default function NotificationsPrototype() {
  const { variant } = useFeed();
  return variant === "D" || variant === "E" ? (
    <VariantDOverviewPage />
  ) : (
    <VariantCInboxPage />
  );
}
