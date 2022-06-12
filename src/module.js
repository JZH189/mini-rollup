import MagicString from "magic-string";
import { parse } from "acorn";
import analyse from "./ast/analyse.js";
import walk from "./ast/walk.js";
import { hasOwn } from "./utils/index.js";

const SYSTEM_VARIABLE = ["console", "log"];

export default class Module {
  constructor({ code, path, bundle }) {
    this.path = path;
    this.bundle = bundle;
    this.imports = {}; // 导入的变量
    this.exports = {}; // 导出的变量
    this.definitions = {}; // 变量定义的语句
    this.code = new MagicString(code, {
      filename: path,
    });
    this.ast = parse(code, {
      ecmaVersion: 2015, //ecmaVersion:表示要解析的ECMAScript版本。必须是3,5,6(或2015)，7(2016)，8(2017)，9(2018)，10(2019)，11(2020)，12(2021)，13(2022，部分支持)或 “latest” (最新的版本)。
      sourceType: "module", //sourceType 指代码解析的模式。可以是 “script” 或“module”。这将影响导入和导出声明的全局严格模式和解析。
    });
    this.analyse(); //分析ast
  }
  analyse() {
    let magicString = this.code;
    // 1、删除冗余逻辑
    this.ast.body.forEach((statement) => {
      function generateBodystr(bodyList) {
        let result = "";
        bodyList.forEach((body) => {
          result += magicString.snip(body.start, body.end).trim();
        });
        return result;
      }
      function operateAst(node) {
        switch (node.type) {
          case "IfStatement":
            if (node.test.type === "Literal") {
              const value = node.test.value;
              if (value === false || value === 0) {
                //if语句执行结果为 false
                if (node.alternate === null) {
                  //不存在else语句删除整个节点
                  magicString.remove(node.start, node.end);
                } else {
                  const source = generateBodystr(node.alternate.body);
                  magicString.overwrite(node.start, node.end, source);
                }
              } else {
                //if语句执行结果为 true
                const source = generateBodystr(node.consequent.body);
                magicString.overwrite(node.start, node.end, source);
              }
            }
            break;
          case "FunctionDeclaration":
            const functionBodyStatement = node.body.body
            // 遍历body节点删除冗余逻辑
            functionBodyStatement.forEach((ast, index) => {
              if(ast.type === "ReturnStatement") {
                if(ast.argument) {
                    if(ast.argument.type === "Literal") {
                      if(ast.argument.value === false) {
                        magicString.overwrite(ast.argument.end, node.end, "\n}");
                      }
                    }
                }
              } else if(ast.type === "IfStatement") {
                if(ast.test) {
                  if(ast.test.type === "Literal") {
                    if(ast.test.value === false) {
                      magicString.remove(ast.start, ast.end);
                    }
                  }
                }
              }
            })
            break;
        }
      }
      walk(statement, operateAst(statement));
    });

    // 2、收集模块的导入和导出
    this.ast.body.forEach((node) => {
      let source;
      // 收集 imports
      if (node.type === "ImportDeclaration") {
        source = node.source.value; //导入的源文件
        //遍历语句收集导入的的变量
        node.specifiers.forEach((specifier) => {
          const localName = specifier.local.name;
          const name = specifier.imported.name; //导入的变量名
          this.imports[localName] = {
            source,
            name,
            localName,
          };
        });
        // 收集 exports
      } else if (/^Export/.test(node.type)) {
        // 导出语句
        // export default function foo () {}
        // export default foo;
        if (node.type === "ExportDefaultDeclaration") {
          const isDeclaration = /Declaration$/.test(node.declaration.type);
          this.exports.default = {
            node,
            name: "default",
            localName: isDeclaration ? node.declaration.id.name : "default",
            isDeclaration,
          };
        }
        // export { foo, bar, baz }
        // export var foo = 42;
        // export function foo () {}
        else if (node.type === "ExportNamedDeclaration") {
          source = node.source && node.source.value;
          if (node.specifiers.length) {
            // export { foo, bar, baz }
            node.specifiers.forEach((specifier) => {
              const localName = specifier.local.name;
              const exportedName = specifier.exported.name;
              this.exports[exportedName] = {
                localName,
                exportedName,
              };
              if (source) {
                this.imports[localName] = {
                  source,
                  localName,
                  name: exportedName,
                };
              }
            });
          } else {
            let declaration = node.declaration;
            let name;
            if (declaration.type === "VariableDeclaration") {
              // export var foo = 42
              name = declaration.declarations[0].id.name;
            } else {
              // export function foo () {}
              name = declaration.id.name;
            }
            this.exports[name] = {
              node,
              localName: name,
              expression: declaration,
            };
          }
        }
      }
    });
    // 3、深度优先遍历ast并且记录所有语句的_dependsOn、_defines 等等
    analyse(this.ast, this.code, this);
    // 4、记录 statement 中 definitions 
    this.ast.body.forEach((statement) => {
      Object.keys(statement._defines).forEach((name) => {
        this.definitions[name] = statement;
      });
    });
  }
  expandAllStatements() {
    const allStatements = [];
    this.ast.body.forEach((statement) => {
      if (statement.type === "ImportDeclaration") {
        return;
      }
      if (statement.type === "VariableDeclaration") {
        return;
      }
      const statements = this.expandStatement(statement);
      allStatements.push(...statements);
    });
    return allStatements;
  }
  expandStatement(statement) {
    statement._included = true;
    const result = [];
    const dependencies = Object.keys(statement._dependsOn);
    dependencies.forEach((dependence) => {
      const definition = this.define(dependence);
      result.push(...definition);
    });
    result.push(statement);
    return result;
  }
  define(name) {
    //如果是外部引入的，递归找到上级 module
    if (hasOwn(this.imports, name)) {
      const importDeclaration = this.imports[name];
      const preModule = this.bundle.fetchModule(
        importDeclaration.source,
        this.path
      );
      const exportDeclaration = preModule.exports[importDeclaration.name];
      if (!exportDeclaration) {
        throw new Error(
          `Module ${preModule.path} does not export ${importDeclaration.name} (imported by ${this.path})`
        );
      }
      return preModule.define(exportDeclaration.localName);
    } else {
      //当前模块定义的
      let statement = this.definitions[name];
      if (statement) {
        if (statement._included) {
          return [];
        } else {
          return this.expandStatement(statement);
        }
      } else if (SYSTEM_VARIABLE.includes(name)) {
        return [];
      } else {
        throw new Error(`variable '${name}' is not exist`);
      }
    }
  }
}
