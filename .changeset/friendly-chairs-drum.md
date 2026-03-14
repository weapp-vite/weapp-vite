---
'create-weapp-vite': patch
'weapp-vite': patch
'weapp-vite-wevu-template': patch
'weapp-vite-wevu-tailwindcss-tdesign-template': patch
---

修复 `autoRoutes` 对显式分包根目录的默认扫描回归，补齐源码 CLI 在 Node 22 下的 `createRequire` 绝对路径处理，并将 `tsconfig paths` 解析提升为 `weapp-vite` 默认行为。同步更新 wevu 模板与相关 e2e 断言，确保模板构建、分包输出和自动导入类型产物保持一致。
