import handler from "../[...path].js";

export default function entriesHandler(req, res) {
  req.query = { ...req.query, path: ["leaderboard", "entries"] };
  return handler(req, res);
}
