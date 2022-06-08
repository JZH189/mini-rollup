import url from "url";
import path from "path";

export function getPath(route) {
  const __filename = url.fileURLToPath(route);
  const __dirname = path.dirname(__filename);
  return { __filename, __dirname };
}

export function hasOwn(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}
