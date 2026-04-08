---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复原生小程序 `.wxml` 模板中的 `import.meta.env` 没有被替换的问题。现在像 `{{import.meta.env.VITE_FOO}}` 这样的表达式会在输出模板阶段按当前环境变量定义展开，不再把 `import.meta.env.*` 原样透传到最终产物。
