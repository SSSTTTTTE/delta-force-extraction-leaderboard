import handler from "../../[...path].js";

export default function playerHandler(req, res) {
  req.query = {
    ...req.query,
    path: ["leaderboard", "player", String(req.query?.playerId ?? "")],
  };
  return handler(req, res);
}
