## Validation Notes

- `dev:ui` 是首选本地反馈路径，因为它会通过 `wv dev --ui` 注入 dashboard 所需的真实分析上下文。
- 页面优化必须在本 app 启动后查看可访问地址，再根据实际渲染调整布局、文字密度、状态区和响应式表现。
- 如果 dashboard 源码在同一工作轮次再次变更，重新运行 `pnpm --filter @weapp-vite/dashboard build` 后再刷新或重启本 app 验证。
