---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `weapp-vite` 包内多处 TypeScript 类型问题，并收敛包级 `tsc` 检查范围到发布源码：  
- 修正 npm 打包器中 Babel 导出节点与支付宝 npm 模式的类型不匹配；  
- 修正路由监听事件分支、lib 入口类型回退、作用域插槽平台配置空值判断与共享构建输出回调参数类型；  
- 修正自动导入产物同步时 `outputPath` 缩窄后的可空类型告警；  
- `packages/weapp-vite/tsconfig.json` 排除 `*.test.ts` 与 `test/`，避免测试夹具类型噪音干扰包级 typecheck。  
