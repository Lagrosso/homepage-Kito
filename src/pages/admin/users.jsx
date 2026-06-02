import classNames from "classnames";
import AdminTabs from "components/admin/admin-tabs";
import { CONFIG_TABS, inputClass } from "components/admin/config-editor";
import LogoutButton from "components/admin/logout-button";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { MdHome } from "react-icons/md";

const ROLE_OPTIONS = ["admin", "viewer"];

const BTN_PRIMARY =
  "rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "rounded-md border border-theme-300 dark:border-theme-600 px-3 py-2 text-sm font-medium text-theme-700 dark:text-theme-200 hover:bg-theme-100 dark:hover:bg-theme-700/40 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_DANGER =
  "rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed";

function groupsToText(groups) {
  return Array.isArray(groups) ? groups.join(", ") : "";
}

function StatusBanner({ status }) {
  if (!status) return null;
  const cls =
    status.type === "error"
      ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
      : status.type === "success"
        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
        : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
  return <p className={`rounded-md px-3 py-2 text-sm ${cls}`}>{status.message}</p>;
}

function isLastAdmin(user, users) {
  return user.role === "admin" && users.filter((candidate) => candidate.role === "admin").length === 1;
}

export default function AdminUsers() {
  const router = useRouter();
  const [authState, setAuthState] = useState("checking");
  const [currentUser, setCurrentUser] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState(null);
  const [savingUser, setSavingUser] = useState(null);
  const [passwords, setPasswords] = useState({});
  const [groups, setGroups] = useState({});
  const [newUser, setNewUser] = useState({ username: "", role: "viewer", password: "", groups: "" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then(async (res) => {
        if (res.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(router.asPath || "/admin/users")}`);
          return;
        }
        if (!res.ok) throw new Error(`Failed to check session (${res.status})`);
        const data = await res.json();
        if (data?.user?.role !== "admin") {
          if (!cancelled) setAuthState("denied");
          router.replace("/");
          return;
        }
        if (!cancelled) {
          setCurrentUser(data.user);
          setAuthState("admin");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setAuthState("denied");
          setLoadState("error");
          setStatus({ type: "error", message: e.message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const loadUsers = useCallback(() => {
    setLoadState("loading");
    return fetch("/api/users")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error ?? `Failed to load users (${res.status})`);
        }
        const loadedUsers = data.users ?? [];
        setUsers(loadedUsers);
        setGroups(
          loadedUsers.reduce((acc, user) => {
            acc[user.username] = groupsToText(user.groups);
            return acc;
          }, {}),
        );
        setLoadState("ready");
      })
      .catch((e) => {
        setLoadState("error");
        setStatus({ type: "error", message: e.message });
      });
  }, []);

  useEffect(() => {
    if (authState === "admin") {
      loadUsers();
    }
  }, [authState, loadUsers]);

  const requestUsers = async (message, options) => {
    setStatus(null);
    const res = await fetch("/api/users", {
      ...options,
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error ?? `Request failed (${res.status})`);
    }
    setStatus({ type: "success", message });
    await loadUsers();
    return data;
  };

  const updateRole = async (username, role) => {
    setSavingUser(username);
    try {
      await requestUsers(`Role updated for ${username}.`, {
        method: "PATCH",
        body: JSON.stringify({ username, role }),
      });
    } catch (e) {
      setStatus({ type: "error", message: e.message });
    } finally {
      setSavingUser(null);
    }
  };

  const updateGroups = async (username) => {
    setSavingUser(username);
    try {
      await requestUsers(`Groups updated for ${username}.`, {
        method: "PATCH",
        body: JSON.stringify({ username, groups: groups[username] ?? "" }),
      });
    } catch (e) {
      setStatus({ type: "error", message: e.message });
    } finally {
      setSavingUser(null);
    }
  };

  const resetPassword = async (username) => {
    setSavingUser(username);
    try {
      await requestUsers(`Password updated for ${username}.`, {
        method: "PATCH",
        body: JSON.stringify({ username, password: passwords[username] ?? "" }),
      });
      setPasswords((prev) => ({ ...prev, [username]: "" }));
    } catch (e) {
      setStatus({ type: "error", message: e.message });
    } finally {
      setSavingUser(null);
    }
  };

  const removeUser = async (username) => {
    setSavingUser(username);
    try {
      await requestUsers(`Deleted ${username}.`, {
        method: "DELETE",
        body: JSON.stringify({ username }),
      });
    } catch (e) {
      setStatus({ type: "error", message: e.message });
    } finally {
      setSavingUser(null);
    }
  };

  const addNewUser = async (e) => {
    e.preventDefault();
    setSavingUser("__new__");
    try {
      await requestUsers(`Created ${newUser.username.trim()}.`, {
        method: "POST",
        body: JSON.stringify(newUser),
      });
      setNewUser({ username: "", role: "viewer", password: "", groups: "" });
    } catch (err) {
      setStatus({ type: "error", message: err.message });
    } finally {
      setSavingUser(null);
    }
  };

  if (authState === "checking" || authState === "denied") {
    return null;
  }

  return (
    <>
      <Head>
        <title>User Management</title>
      </Head>
      <div className="admin-shell min-h-screen bg-theme-50 dark:bg-theme-900 text-theme-900 dark:text-theme-100">
        <header className="flex items-center justify-between px-4 py-3 border-b border-theme-200 dark:border-theme-700 bg-white dark:bg-theme-900">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Dashboard"
              className="flex items-center gap-1 text-theme-500 hover:text-theme-700 dark:hover:text-theme-200"
            >
              <MdHome className="w-5 h-5" />
            </Link>
            <span className="text-theme-300 dark:text-theme-600">/</span>
            <span className="text-sm font-medium">User Management</span>
            {currentUser && (
              <span className="hidden sm:inline text-xs text-theme-400 ml-2">({currentUser.username})</span>
            )}
          </div>
          <LogoutButton />
        </header>

        <AdminTabs tabs={CONFIG_TABS} activeHref={router.pathname} />

        <main className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6">
          <div>
            <h1 className="text-lg font-semibold">Users</h1>
            <p className="text-sm text-theme-500">Manage roles and password resets. Usernames cannot be changed.</p>
          </div>

          <StatusBanner status={status} />
          {loadState === "loading" && <p className="text-sm text-theme-500">Loading users...</p>}

          {loadState === "ready" && (
            <>
              <section className="overflow-x-auto rounded-md border border-theme-300 dark:border-theme-700 bg-white dark:bg-theme-800">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-theme-200 dark:border-theme-700 text-left text-theme-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Username</th>
                      <th className="px-3 py-2 font-medium">Role</th>
                      <th className="px-3 py-2 font-medium">Groups</th>
                      <th className="px-3 py-2 font-medium">Password reset</th>
                      <th className="px-3 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const lastAdmin = isLastAdmin(user, users);
                      return (
                        <tr key={user.username} className="border-b border-theme-100 dark:border-theme-700/70">
                          <td className="px-3 py-3 font-medium">{user.username}</td>
                          <td className="px-3 py-3">
                            <select
                              aria-label={`Role for ${user.username}`}
                              value={user.role}
                              disabled={savingUser === user.username || lastAdmin}
                              onChange={(e) => updateRole(user.username, e.target.value)}
                              className={`${inputClass} min-w-[8rem]`}
                            >
                              {ROLE_OPTIONS.map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex min-w-[14rem] gap-2">
                              <input
                                aria-label={`Groups for ${user.username}`}
                                value={groups[user.username] ?? ""}
                                onChange={(e) => setGroups((prev) => ({ ...prev, [user.username]: e.target.value }))}
                                placeholder="family, media"
                                className={inputClass}
                              />
                              <button
                                type="button"
                                disabled={savingUser === user.username}
                                onClick={() => updateGroups(user.username)}
                                className={BTN_SECONDARY}
                              >
                                Save
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex min-w-[16rem] gap-2">
                              <input
                                aria-label={`New password for ${user.username}`}
                                type="password"
                                value={passwords[user.username] ?? ""}
                                onChange={(e) =>
                                  setPasswords((prev) => ({ ...prev, [user.username]: e.target.value }))
                                }
                                className={inputClass}
                              />
                              <button
                                type="button"
                                disabled={savingUser === user.username}
                                onClick={() => resetPassword(user.username)}
                                className={BTN_SECONDARY}
                              >
                                Reset
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              disabled={savingUser === user.username || lastAdmin}
                              onClick={() => removeUser(user.username)}
                              className={BTN_DANGER}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>

              <form
                onSubmit={addNewUser}
                className="rounded-md border border-theme-300 dark:border-theme-700 bg-white dark:bg-theme-800 p-4"
              >
                <h2 className="text-base font-semibold mb-3">Add User</h2>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_10rem_1fr_1fr_auto] gap-3 items-end">
                  <label className="block text-sm">
                    <span className="block font-medium mb-1">Username</span>
                    <input
                      value={newUser.username}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, username: e.target.value }))}
                      className={inputClass}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="block font-medium mb-1">Role</span>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value }))}
                      className={inputClass}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="block font-medium mb-1">Password</span>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                      className={inputClass}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="block font-medium mb-1">Groups</span>
                    <input
                      value={newUser.groups}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, groups: e.target.value }))}
                      placeholder="family, media"
                      className={inputClass}
                    />
                  </label>
                  <button type="submit" disabled={savingUser === "__new__"} className={BTN_PRIMARY}>
                    Add
                  </button>
                </div>
              </form>
            </>
          )}
        </main>
      </div>
    </>
  );
}
