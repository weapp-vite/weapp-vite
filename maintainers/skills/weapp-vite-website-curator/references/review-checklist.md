# Review Checklist

- 检查 `packages/*/package.json` 与文档中的包名、安装名一致。
- 检查文档示例 API 在 `src/index.ts` 中可找到导出。
- 检查 `website/.vitepress/config.ts` 的侧边栏与页面路径一致。
- 运行 `pnpm build`（在 `website/`）并确认无链接错误。
- 检查新增页面是否被首页/导航发现（至少在 sidebar 可达）。
