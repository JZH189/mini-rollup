import { name, age } from "./user.js";

function foo() {
  console.log("这段代码将会保留");
  if(false){
  	console.log("这段代码将会被删除")
  }
  return false
  console.log("这段代码将会被删除");
}

if (true) {
  console.log("代码1");
} else {
  console.log("代码2");
}

// 导出一个foo函数
export default function hello() {
  console.log(`hello! ${name}`);
}
