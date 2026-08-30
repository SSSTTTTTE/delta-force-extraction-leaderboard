import handler from "../[...path].js";

export default function adjustHandler(req, res) {
  req.query = { ...req.query, path: ["admin", "adjust"] };
  return handler(req, res);
}
