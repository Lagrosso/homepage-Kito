import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

function safeNext(value) {
  const next = Array.isArray(value) ? value[0] : value;
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }
  if (next === "/login" || next === "/setup") {
    return "/";
  }
  return next;
}

export default function LoginPage() {
  const router = useRouter();
  const next = useMemo(() => safeNext(router.query.next), [router.query.next]);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/state")
      .then((res) => (res.ok ? res.json() : null))
      .then((state) => {
        if (cancelled) return;
        if (state?.setupRequired) {
          router.replace("/setup");
          return;
        }
        setChecking(false);
      })
      .catch(() => {
        if (!cancelled) {
          setChecking(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError("The username or password is incorrect.");
        return;
      }
      router.replace(next);
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Homepage - Login</title>
      </Head>
      <main className="min-h-screen bg-theme-50 dark:bg-theme-900 text-theme-800 dark:text-theme-200 flex items-center justify-center p-6">
        <section className="w-full max-w-sm">
          <h1 className="text-2xl font-bold mb-2">Login</h1>
          <p className="text-sm text-theme-500 mb-5">
            Sign in to view the dashboard. If this is the first start, continue with setup.
          </p>
          {checking ? (
            <p className="text-sm text-theme-500">Checking setup state...</p>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Username</span>
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-md border border-theme-300 dark:border-theme-700 bg-white dark:bg-theme-800 px-3 py-2"
                  required
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-theme-300 dark:border-theme-700 bg-white dark:bg-theme-800 px-3 py-2"
                  required
                />
              </label>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? "Signing in..." : "Sign in"}
              </button>
              <Link href="/setup" className="text-sm text-theme-500 hover:text-theme-700 dark:hover:text-theme-300">
                First start? Create the first admin account.
              </Link>
            </form>
          )}
        </section>
      </main>
    </>
  );
}
