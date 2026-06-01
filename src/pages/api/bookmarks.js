import { bookmarksResponse } from "utils/config/api-response";
import { getSession } from "utils/config/session";
import { findUser } from "utils/config/users";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  const user = session?.user?.username ? (findUser(session.user.username) ?? session.user) : session?.user;
  res.send(await bookmarksResponse(user));
}
