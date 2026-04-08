---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复小程序产物里 `import.meta` 相关静态值没有被展开的问题。现在原生 `.wxml` 模板与源码脚本中的 `import.meta.env`、`import.meta.url`、`import.meta.dirname`，以及裸 `import.meta`，都会在输出阶段按当前模块的静态上下文展开，避免把这些表达式原样透传到最终产物。
