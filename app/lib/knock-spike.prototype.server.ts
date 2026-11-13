// PROTOTYPE — throwaway. Answers "Does Knock hold up against Cadence?".
// Lives on the prototype/knock-spike branch only; never merge.
import Knock, { signUserToken } from "@knocklabs/node";

if (!process.env.KNOCK_SECRET_API_KEY) {
  // Vite doesn't put non-VITE_ vars on process.env in dev.
  process.loadEnvFile(".env");
}

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} missing from .env`);
  return value;
}

export const knock = new Knock({ apiKey: env("KNOCK_SECRET_API_KEY") });

export const knockPublicConfig = () => ({
  publicApiKey: env("KNOCK_PUBLIC_API_KEY"),
  feedChannelId: env("KNOCK_FEED_CHANNEL_ID"),
});

// Cadence user ids are numbers; Knock ids are strings. Prefix so a bare "5"
// never collides with anything else we might put in Knock later.
export const knockUserId = (id: number) => `user-${id}`;

export async function identify(user: {
  id: number;
  name: string;
  email: string;
}) {
  await knock.users.update(knockUserId(user.id), {
    name: user.name,
    email: user.email,
  });
}

export function signFor(userId: number) {
  return signUserToken(knockUserId(userId), {
    signingKey: env("KNOCK_SIGNING_KEY"),
    expiresInSeconds: 60 * 60,
  });
}
