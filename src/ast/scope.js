export default class Scope {
  constructor(options = {}) {
    this.parent = options.parent;
    this.names = options.params || [];
    this.isBlockScope = !!options.block; // 是否为块作用域
  }
  add(name, isBlockDeclaration) {
    // 当前作用域是块级作用域 && 此语句为var或申明函数
    if (this.isBlockScope && !isBlockDeclaration) {
      this.parent.add(name, isBlockDeclaration);
    } else {
      this.names.push(name);
    }
  }
  findDefiningScope(name) {
    if (this.names.includes(name)) {
      return this;
    }
    if (this.parent) {
      return this.parent.findDefiningScope(name);
    }
    return null;
  }
}
