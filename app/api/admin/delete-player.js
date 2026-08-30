import handler from "../[...path].js";

export default function deletePlayerHandler(req, res) {
  req.query = { ...req.query, path: ["admin", "delete-player"] };
  return handler(req, res);
}
