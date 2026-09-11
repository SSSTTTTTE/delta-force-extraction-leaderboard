import handler from "../[...path].js";

export default function renameHandler(req, res) {
  req.query = { ...req.query, path: ["admin", "rename"] };
  return handler(req, res);
}
