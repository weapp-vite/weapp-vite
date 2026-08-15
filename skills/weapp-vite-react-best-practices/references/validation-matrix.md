# React 验证矩阵

| 层级             | 覆盖目标                                                     | 推荐入口                                          |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| Runtime 单测     | Hooks 更新、事件、序列化、static bindings                    | `packages-runtime/react/src/renderer.test.tsx`    |
| 编译测试         | JSX transform、WXML emit、bridge 注册诊断、Compiler fallback | `packages/weapp-vite/src/plugins/react/*.test.ts` |
| 构建 e2e         | React/原生/Wevu 产物和公开模板                               | `e2e/ci/react-interop.build.test.ts`              |
| DevTools runtime | Hooks、事件、static payload、真实组件互操作                  | `e2e/ide/react-runtime-spike.runtime.test.ts`     |

验证时遵循：

- 改动 `packages-runtime/react/src/**` 或 `packages/weapp-vite/src/**` 后，先重建对应包再跑下游 app/e2e。
- 仓库级 e2e 全局串行，启动前清理残留 DevTools、automator、watch 和本地服务。
- 先断言公开 API、结构化 snapshot、路由和事件结果，不匹配压缩变量名或 chunk hash。
- Web、支付宝或抖音构建成功不能作为 React runtime 兼容结论。
