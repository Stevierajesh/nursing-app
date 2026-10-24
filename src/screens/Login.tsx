import { useState } from "react";
import { useAuth } from "../lib/auth";
import { Button, ErrorNote } from "../components/Primitives";

export default function Login() {
  const { signIn, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(email, password);
    } catch {
      // surfaced via the auth context's error
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col justify-center p-6">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-3xl font-bold">Nurse Worry Layer</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-400">
          One tap to turn what you already noticed into something the system
          can act on.
        </p>

        <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm text-ink-200">
              Email
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-ink-600 bg-ink-800 p-3 text-base focus:border-ink-400 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm text-ink-200"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-ink-600 bg-ink-800 p-3 text-base focus:border-ink-400 focus:outline-none"
            />
          </div>

          {error && <ErrorNote>{error}</ErrorNote>}

          <Button type="submit" disabled={busy} className="mt-2 w-full">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
