import handler from "../[...path].js";

export default function playersHandler(req, res) {
  req.query = { ...req.query, path: ["admin", "players"] };
  return handler(req, res);
}
