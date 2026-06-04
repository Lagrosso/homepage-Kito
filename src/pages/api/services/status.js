import { buildServiceStatusReport, filterStatuses, sortStatuses } from "utils/config/service-status";
import { getSession, isAuthenticatedSession } from "utils/config/session";
import { findUser } from "utils/config/users";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);
  if (!isAuthenticatedSession(session)) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const user = session.user.username ? (findUser(session.user.username) ?? session.user) : session.user;
  const report = await buildServiceStatusReport(user);
  const filter = typeof req.query.filter === "string" ? req.query.filter : "all";
  const source = typeof req.query.source === "string" ? req.query.source : "all";
  const services = sortStatuses(filterStatuses(report.services, filter, source));

  return res.status(200).json({
    generatedAt: report.generatedAt,
    summary: report.summary,
    services,
  });
}
