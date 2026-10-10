---
'create-weapp-vite': patch
'weapp-vite': minor
---

fix(compiler): 完善入口、配置和外部依赖的识别与失效边界，减少重复分析并保持 Windows、符号链接和多平台构建的一致性。

- 自动导入保留每轮组件源码来源、已解析的原生/Vue 入口与显式覆盖；文件时间戳未变化时仍刷新注册。将 `componentGenerics.default` 纳入入口和依赖图，区分声明侧车与编译后自动导入，避免逻辑入口漂移。
- 修复受管 TypeScript 配置首次生成竞态、tsconfig 数组/包继承及子配置 paths 覆盖。高级路径适配使用 vite-tsconfig-paths 7.0.0-alpha.3；`parseNative` 保留类型兼容并标记弃用，不再据此加载 TypeScript 编译器。
- 修复缺失可选依赖时的 npm 目录边界，保持当前工程优先与上级依赖回退；复用 npm 平台 API 分析，保留转义标识符、可选访问和局部绑定语义。
- 保留 Vite 原生插件身份、原型、属性描述和冻结 hook；构建结束释放页面匹配、Vue 选项与提交回调，避免持有已结束上下文。绝对输出目录正确排除在源码监听之外。
- 多平台微信构建无分包时不再输出空 `subPackages`；原生 watch 始终校验当前扫描与最终 app 配置，避免并发保存绕过 worker 校验。
