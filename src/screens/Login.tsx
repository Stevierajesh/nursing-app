import { useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { Button, ErrorNote } from "../components/Primitives";

/*
 * The seeded demo nurses. Tapping one fills the email field and nothing else --
 * no password is stored here or prefilled, so this is an autofill convenience
 * rather than a way in. Patient counts mirror the Python seed and will drift if
 * someone reassigns beds; they are a hint for whoever is demoing, not state.
 */
const DEMO_ACCOUNTS = [
  { email: "maria@mercygeneral.example", name: "Maria Santos", patients: 3 },
  { email: "james@mercygeneral.example", name: "James Okonkwo", patients: 2 },
  { email: "lin@mercygeneral.example", name: "Lin Zhao", patients: 3 },
];

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
}

export default function Login() {
  const { signIn, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

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

  function pick(accountEmail: string) {
    setEmail(accountEmail);
    passwordRef.current?.focus();
  }

  return (
    <div className="relative flex min-h-full flex-col">
      {/* Decorative teal wash, kept out of the a11y tree. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(80%_70%_at_50%_0%,rgba(15,107,107,0.16),transparent_72%)]"
      />

      {/* m-auto centres in the viewport when there is room and lets the page
          grow and scroll when there is not -- a fixed height would clip the
          Sign in button on a short window. */}
      <div className="relative m-auto w-full max-w-md px-6 py-10">
        <div className="flex items-center justify-center gap-2.5">
          {/* Wordmark only until the mark is decided; the bars read as the
              risk glyph used throughout the app. */}
          <span className="flex items-end gap-0.5" aria-hidden>
            <span className="h-2.5 w-1 rounded-sm bg-accent/40" />
            <span className="h-4 w-1 rounded-sm bg-accent/70" />
            <span className="h-5.5 w-1 rounded-sm bg-accent" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">Salus</span>
        </div>

        <div className="mt-7 rounded-3xl border border-ink-700 bg-ink-800 p-6 shadow-xl shadow-ink-200/5">
          <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-ink-400">
            Pick a demo nurse, or use your own account.
          </p>

          <ul className="mt-5 space-y-2">
            {DEMO_ACCOUNTS.map((a) => {
              const active = email === a.email;
              return (
                <li key={a.email}>
                  <button
                    type="button"
                    onClick={() => pick(a.email)}
                    aria-label={`Use ${a.name}'s email`}
                    aria-pressed={active}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 text-left transition ${
                      active
                        ? "border-accent bg-accent/5"
                        : "border-ink-700 hover:border-ink-600 hover:bg-ink-900"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent"
                    >
                      {initials(a.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {a.name}
                      </span>
                      <span className="block truncate text-xs text-ink-400">
                        {a.patients} patients
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={`text-lg transition ${active ? "text-accent" : "text-ink-600"}`}
                    >
                      →
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-ink-700" />
            <span className="text-xs uppercase tracking-widest text-ink-400">
              or
            </span>
            <span className="h-px flex-1 bg-ink-700" />
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium"
              >
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
                className="w-full rounded-xl border border-ink-600 bg-ink-800 p-3 text-base transition focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium"
              >
                Password
              </label>
              <input
                id="password"
                ref={passwordRef}
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-ink-600 bg-ink-800 p-3 text-base transition focus:border-accent focus:outline-none"
              />
            </div>

            {error && <ErrorNote>{error}</ErrorNote>}

            <Button type="submit" disabled={busy} className="mt-2 w-full">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-ink-400">
          Decision support for clinical staff. Salus records nurse judgement
          alongside vitals; it does not order treatment.
        </p>
      </div>
    </div>
  );
}
