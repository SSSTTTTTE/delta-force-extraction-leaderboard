import handler from "./[...path].js";

export default function leaderboardHandler(req, res) {
  req.query = { ...req.query, path: ["leaderboard"] };
  return handler(req, res);
}
