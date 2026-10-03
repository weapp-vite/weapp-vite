---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 npm 候选包解析的目录边界，保持当前工程依赖优先和上级依赖回退，避免缺失可选依赖时将 package.json 当作目录解析并输出 ENOTDIR 错误。
