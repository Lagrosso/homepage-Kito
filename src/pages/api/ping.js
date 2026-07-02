import { promise as ping } from "ping";

import { isVisibleForUser } from "utils/config/access";
import { getMonitorTimeoutSeconds, hasExplicitMonitorTimeout } from "utils/config/monitor-timeout";
import { getServiceItem } from "utils/config/service-helpers";
import { getSession } from "utils/config/session";
import { findUser } from "utils/config/users";
import createLogger from "utils/logger";

const logger = createLogger("ping");

export default async function handler(req, res) {
  const { groupName, serviceName } = req.query;
  const session = await getSession(req, res);
  const user = session?.user?.username ? (findUser(session.user.username) ?? session.user) : { role: "viewer", groups: [] };
  const serviceItem = await getServiceItem(groupName, serviceName);
  if (!serviceItem) {
    logger.debug(`No service item found for group ${groupName} named ${serviceName}`);
    return res.status(400).send({
      error: "Unable to find service, see log for details.",
    });
  }
  if (!isVisibleForUser(serviceItem, user)) {
    return res.status(403).send({ error: "Service is not visible for this user." });
  }

  const { ping: pingHostOrURL } = serviceItem;

  if (!pingHostOrURL) {
    logger.debug("No ping host specified");
    return res.status(400).send({
      error: "No ping host given",
    });
  }

  let hostname = pingHostOrURL;
  try {
    // maintain backwards compatibility with old ping where may be http://...
    hostname = new URL(pingHostOrURL).hostname;
  } catch (e) {}

  try {
    // The ping library is already bounded by its own fast default (~2s). Only
    // override it when the operator has explicitly set HOMEPAGE_MONITOR_TIMEOUT,
    // so the default path stays fast and we never make an unreachable ping slower.
    const config = hasExplicitMonitorTimeout() ? { timeout: getMonitorTimeoutSeconds() } : undefined;
    const response = await ping.probe(hostname, config);
    return res.status(200).json(response);
  } catch (e) {
    logger.debug("Error attempting ping: %s", e);
    return res.status(400).send({
      error: "Error attempting ping, see logs.",
    });
  }
}
