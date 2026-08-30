---
"@weapp-vite/ast-native": patch
"@wevu/compiler": major
---

为 Vue 模板与 JSX 编译结果新增统一的结构化诊断协议，提供稳定的 code、severity、filename、source 与源码 span，并让内联模板诊断映射到完整 SFC 位置。原有 `warnings: string[]` 结果字段已替换为 `diagnostics: CompilerDiagnostic[]`，调用方需要改为读取 `diagnostic.message`；同时增加 Vue 官方编译器语义矩阵、表达式确定性 fuzz 与 native SFC 差分 fuzz。真实 HMR profile 证明完整 block 内容经 Rust、JSON、JS 往返没有稳定收益，因此 `@wevu/compiler` 移除原有 `WEAPP_VITE_NATIVE` SFC signature/组件元信息接入并统一使用 `vue/compiler-sfc`；`@weapp-vite/ast-native` 的直接 block API 继续保留，但对模板、重复属性、实体属性和非法顶层结构 fail closed，后续 native 加速需改为只返回紧凑摘要的粗粒度 batch API 后再重新 profile。
