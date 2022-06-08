import rollup from "../src/rollup.js";
import { resolve } from "path";
import { getPath } from "../src/utils/index.js";
const { __dirname } = getPath(import.meta.url);

const entryPath = resolve(__dirname, `index.js`);

rollup({
  entry: entryPath,
  outputFile: "example/bundle.js",
});
