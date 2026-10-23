---
"@mpcore/simulator": patch
---

fix(simulator): 修复模拟器无法加载压缩、多行及同一行多个声明的 ESM 产物问题。Node 与浏览器共用 AST 模块转换，保留导入及再导出的动态绑定、局部作用域和默认函数提升；CommonJS 产物保持原样执行，不支持的异步模块语法明确报错。
