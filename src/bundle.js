import { readFileSync, writeFileSync } from "fs";
import { resolve, isAbsolute, dirname } from "path";
import { Bundle as MagicBundle } from "magic-string";
import Module from "./module.js";

export default class Bundle {
  constructor(options) {
    // 打包入口
    this.entryPath = resolve(options.entry).replace(/\.js$/, "") + ".js";
    // 最终保留的语句
    this.statements = [];
  }
  build(options) {
    try {
      // 1. 获取入口文件的内容，生成 Module 和 ast
      const entryModule = this.fetchModule(this.entryPath);
      // 2. 对入口文件的 ast 进行依赖解析保留最终的代码
      this.statements = entryModule.expandAllStatements();
      // 3. 生成最终代码
      const codeStr = this.generate();
      console.log(codeStr);
      // 4. 写入目标文件
      writeFileSync(options.outputFile, codeStr);
    } catch (error) {
      console.log("error: ", error);
    }
  }
  fetchModule(importee, importer) {
    let route;
    if (!importer) {
      route = importee;
    } else {
      if (isAbsolute(importee)) {
        route = importee;
      } else if (importee.charAt(0) === ".") {
        // 通过文件目录生成目标文件的绝对路径
        route = resolve(
          dirname(importer),
          importee.replace(/\.js$/, "") + ".js"
        );
      }
    }
    if (route) {
      const code = readFileSync(route, "utf-8");
      const module = new Module({
        code,
        path: importee,
        bundle: this,
      });
      return module;
    }
  }
  generate() {
    let bundle = new MagicBundle();
    this.statements.forEach((statement) => {
      const source = statement._source.clone().trim();
      if (/^Export/.test(statement.type)) {
        // 因为所有语句都打包到一个文件了，所以删除export、export default等等
        source.remove(statement.start, statement.declaration.start);
      }
      bundle.addSource({
        content: source,
        separator: "\n",
      });
    });
    return bundle.toString();
  }
}
