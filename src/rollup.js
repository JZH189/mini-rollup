import Bundle from "./bundle.js";

export default function rollup(options) {
  if (!options || !options.entry) {
    throw new Error("You must supply options.entry to rollup");
  }
  const bundle = new Bundle({
    entry: options.entry,
  });
  bundle.build(options);
}
