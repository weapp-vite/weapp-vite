---
"@wevu/compiler": minor
"wevu": patch
"@weapp-core/constants": minor
"@weapp-core/types": patch
"@weapp-vite/language-service": patch
---

feat(compiler): 支持将 Vue `<Teleport>` 映射为微信小程序原生 `root-portal`。仅静态 `to` 为顶层容器（`body` / `html` / `#app` / `#root`）时转换，`disabled` 取反输出 `enable`，`to` / `defer` 被移除；锚点目标、动态 `:to`、缺少 `to` 以及非微信平台均剥掉标签原位渲染子节点并给出诊断。转换直接输出 `enable`，要求微信基础库不低于 2.26.1，不再为低版本做降级；运行时会在模板映射 `root-portal` 后读取宿主基础库版本，低于 2.25.2 / 2.26.1 时分别提示一次能力缺口。`v-bind` 对象展开改为专用诊断，不再误报缺少 `to`。新增 `vue.template.teleport.enabled`（默认 `true`）与文件级 `weapp-vite:disable-teleport` 关闭开关；`unsupported` 仅控制诊断级别，各降级场景使用稳定子码 `WV1004`–`WV1009`，class/style 透传新增 `WV1009` 提示。JSX `<Teleport>` 复用同一套映射规则（静态 `to` 映射、`disabled` 取反、动态 `to` / spread / 缺少 `to` 降级），不再退化为 dynamic island，并在 `wevu/jsx-runtime` 中补充全局 `<Teleport>` 类型声明与 `WevuJsxTeleportProps` 导出。同时补齐微信 `root-portal` 的 `enable` / `externalClass` 类型声明与模板 schema，并修复 PascalCase `<Teleport>` 被误收集为自动导入组件的问题。
