---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 native layout 构建回归测试对预构建产物的隐式依赖：测试临时项目现在会将 `weapp-vite/runtime` 显式映射到源码入口，避免在干净 CI 环境中因缺少 `dist/runtime.mjs` 而解析失败，从而稳定 release 流程中的 `layoutBuild.native.test.ts`。
