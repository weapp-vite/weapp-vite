---
"wevu": minor
"@wevu/compiler": minor
"weapp-vite": minor
"create-weapp-vite": patch
"@weapp-core/shared": minor
"@weapp-core/constants": patch
"@weapp-vite/react": patch
"@mpcore/simulator": patch
"@weapp-vite/i18n": patch
"@weapp-vite/mcp": patch
"@weapp-vite/web": patch
"@wevu/test-utils": patch
"@wevu/web-apis": patch
---

feat(wevu): 为 SFC 增加可选的抖音 Render Mode V2 原生 DOM 编译与渲染，默认保持 legacy。

通过 `weapp.wevu.renderer` 选择 `legacy`、`auto` 或 `native-dom`。TT 的 auto 在首次 setup 前检测文档能力，缺失时使用原模板；原生路径使用 Wevu 响应式与调度器驱动节点更新，不调用 setData。React 与 Wevu 共享平台能力探针和原生组件创建契约。

首版支持同步 setup 的 SFC、条件、列表、插槽、组件 props/emit/model、style 清理、事件与卸载；未适配的组合明确报错。真实 TT runtime 验收待补。
