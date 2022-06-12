import Scope from "./scope.js";
import walk from "./walk.js";

export default function analyse(ast, magicString, module) {
  let scope = new Scope(); //创建一个顶层作用域

  ast.body.forEach((statement) => {
    function addToScope(declarator, isBlockDeclaration = false) {
      const { name } = declarator.id;
      scope.add(name, isBlockDeclaration);
      if (!scope.parent) {
        // 如果没有父作用域，说明是模块内定义的
        statement._defines[name] = true;
      }
    }
    //为语句定义额外的属性用于记录变量的定义和依赖关系，以及源码字符串内容
    Object.defineProperties(statement, {
      _defines: { value: {} }, //存放当前模块定义的所有的全局变量
      _dependsOn: { value: {} }, //当前模块没有定义但是使用到的变量，也就是依赖的外部变量
      _included: { value: false, writable: true }, //此语句是否已经被包含到打包结果中，防止重复打包
      _module: { value: module }, // 当前语句所在的 module
      _source: { value: magicString.snip(statement.start, statement.end) }, // 保存原语句
    });
    // 深度遍历每个语句，记录其作用域和作用域链
    walk(
      statement,
      function enter(node) {
        let newScope;
        switch (node.type) {
          case "FunctionExpression":
          case "FunctionDeclaration":
            const params = node.params.map((p) => p.name);
            if (node.type === "FunctionDeclaration") {
              addToScope(node);
            } else if (node.type === "FunctionExpression" && node.id) {
              params.push(node.id.name);
            }
            newScope = new Scope({
              parent: scope,
              params,
              block: true,
            });
            break;
          case "BlockStatement":
            newScope = new Scope({
              parent: scope,
              block: true,
            });
            break;
          case "VariableDeclaration":
            node.declarations.forEach((variableDeclarator) => {
              if (node.kind === "let" || node.kind === "const") {
                addToScope(variableDeclarator, true);
              } else {
                addToScope(variableDeclarator, false);
              }
            });
            break;
        }
        if (newScope) {
          Object.defineProperty(node, "_scope", {
            value: newScope,
          });
          //更新作用域链
          scope = newScope;
        }
      },
      function leave(node) {
        if (node._scope) {
          scope = scope.parent;
        }
      }
    );
  });

  ast.body.forEach((statement) => {
    // 收集外部依赖的变量
    function checkForReads(node) {
      if (node.type === "Identifier") {
        const { name } = node;
        const definingScope = scope.findDefiningScope(name);
        // 当前作用域中找不到则说明为外部依赖
        if (!definingScope) {
          statement._dependsOn[name] = true;
        }
      }
    }
    // 收集变量修改的语句
    function checkForWrites(node) {
      function addNode(node) {
        while (node.type === "MemberExpression") {
          node = node.object;
        }
        if (node.type !== "Identifier") {
          return;
        }
        statement._modifies[node.name] = true;
      }
      if (node.type === "AssignmentExpression") {
        // 赋值语句
        addNode(node.left);
      } else if (node.type === "UpdateExpression") {
        // 更新语句
        addNode(node.argument);
      } else if (node.type === "CallExpression") {
        // 函数调用
        node.arguments.forEach((arg) => addNode(arg));
      }
    }
    walk(
      statement,
      function enter(node) {
        if (node._scope) {
          scope = node._scope;
        }
        checkForReads(node);
        checkForWrites(node);
      },
      function leave(node) {
        if (node._scope) {
          scope = scope.parent;
        }
      }
    );
  });
}
