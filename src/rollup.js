import Bundle from "./bundle.js";

export default function rollup(options = {}) {
  const bundle = new Bundle({
    entry: options.entry,
  });
  bundle.build(options);
}
