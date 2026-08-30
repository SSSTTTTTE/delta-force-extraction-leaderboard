import handler from "../[...path].js";

export default function deleteEntryHandler(req, res) {
  req.query = { ...req.query, path: ["admin", "delete-entry"] };
  return handler(req, res);
}
