import handler from "../[...path].js";

export default function loginHandler(req, res) {
  req.query = { ...req.query, path: ["admin", "login"] };
  return handler(req, res);
}
