# 与 weapp-vite 的协作建议

结构与分包

- 主包最小化：首屏仅保留必要页面与基座逻辑；其余业务拆到分包。
- 以业务边界拆分：如 `packages/order`、`packages/profile`，减少跨包耦合。
- 公共样式与工具：放主包或公共目录，交由构建器复制或抽取。

自动导入与样式注入

- 组件自动导入：约定 `components/**/*.wxml` 扫描；分包可单独配置开关或覆盖规则。
- 样式注入：支持 `wxss/css/scss/less/stylus`，可按作用域（pages/components）注入共享主题或分包差异样式。

按需与异步

- 开启 `lazyCodeLoading: "requiredComponents"` 让组件代码按需拉取（含分包组件）。
- 使用动态 `import()` 让非首屏逻辑拆分为独立 chunk，结合共享策略避免重复落地。

分析与排查

- 使用分析命令查看主包/分包产物与共享模块；关注构建日志的 `[subpackages]` 警告。
- 若分包样式缺失，核对样式文件路径与 include/exclude 规则是否匹配。
- 检查开发者工具的包体积面板，保持主包与分包体积在限制内。
