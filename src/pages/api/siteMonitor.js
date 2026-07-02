import { performance } from "perf_hooks";

import { isVisibleForUser } from "utils/config/access";
import { getMonitorTimeoutMs } from "utils/config/monitor-timeout";
import { getServiceItem } from "utils/config/service-helpers";
import { getSession } from "utils/config/session";
import { findUser } from "utils/config/users";
import createLogger from "utils/logger";
import { httpProxy } from "utils/proxy/http";

const logger = createLogger("siteMonitor");

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

  const { siteMonitor: monitorURL } = serviceItem;

  if (!monitorURL) {
    logger.debug("No http monitor URL specified");
    return res.status(400).send({
      error: "No http monitor URL given",
    });
  }

  // A reachability probe only needs a fast up/down answer; bound it so an
  // unreachable host can't hang the request (and saturate the browser's
  // per-origin connection pool). Configurable via HOMEPAGE_MONITOR_TIMEOUT.
  const timeout = getMonitorTimeoutMs();

  try {
    let startTime = performance.now();
    let [status, , data] = await httpProxy(monitorURL, {
      method: "HEAD",
      timeout,
    });
    let endTime = performance.now();

    // httpProxy returns a synthetic 500 with an { error } body on a network
    // error/timeout. In that case the host is unreachable, so a GET retry would
    // just double the wait — only retry when HEAD got a real response that
    // rejected the method (e.g. 405).
    const headNetworkError = status === 500 && data?.error;
    if (status > 403 && !headNetworkError) {
      // try one more time as a GET in case HEAD is rejected for whatever reason
      startTime = performance.now();
      [status] = await httpProxy(monitorURL, { timeout });
      endTime = performance.now();
    }

    return res.status(200).json({
      status,
      latency: endTime - startTime,
    });
  } catch (e) {
    logger.debug("Error attempting http monitor: %s", e);
    return res.status(400).send({
      error: "Error attempting http monitor, see logs.",
    });
  }
}
