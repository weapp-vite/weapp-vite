---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `autoRoutes` 生成的 `typed-router.d.ts` 在声明 `wevu/router` 时未先导入原模块的问题。此前 TypeScript 可能将其当作独立模块声明，导致 `useRouter` 等已导出成员在编辑器中被错误标记为不存在。现在生成文件会先 `import 'wevu/router'` 再做模块增强，确保路由类型扩展与原有导出可同时生效，并补充相应测试防回归。
