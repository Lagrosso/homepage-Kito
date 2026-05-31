import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/state")
      .then((res) => (res.ok ? res.json() : null))
      .then((state) => {
        if (cancelled) return;
        if (state?.hasUsers) {
          router.replace("/login");
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
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.status === 409) {
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        setError("Setup failed. Check the username and password.");
        return;
      }
      router.replace("/");
    } catch {
      setError("Setup failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Homepage - Setup</title>
      </Head>
      <main className="min-h-screen bg-theme-50 dark:bg-theme-900 text-theme-800 dark:text-theme-200 flex items-center justify-center p-6">
        <section className="w-full max-w-sm">
          <h1 className="text-2xl font-bold mb-2">Create admin account</h1>
          <p className="text-sm text-theme-500 mb-5">
            Setup is only available before the first user exists. This account will be an admin.
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
                  autoComplete="new-password"
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
                {submitting ? "Creating..." : "Create admin"}
              </button>
              <Link href="/login" className="text-sm text-theme-500 hover:text-theme-700 dark:hover:text-theme-300">
                Already set up? Go to login.
              </Link>
            </form>
          )}
        </section>
      </main>
    </>
  );
}
