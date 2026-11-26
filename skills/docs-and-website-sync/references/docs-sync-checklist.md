# Docs Sync Checklist

## 先查事实来源

- `package.json`
- `packages/*/README.md`
- `packages/weapp-vite/src/cli/**`
- `packages/weapp-vite/src/types/config/**`
- `packages/weapp-vite/src/plugins/react/**`
- `packages-runtime/react/src/**`
- `packages-runtime/wevu/src/**`
- `mpcore/packages/**`
- `packages/weapp-vite/docs/README.md`
- `packages/weapp-vite/docs/mcp.md`
- `packages/weapp-vite/docs/volar.md`
- `packages/weapp-vite/docs/define-config-overloads.md`
- `packages/weapp-vite/docs/packaged/**`
- `packages/weapp-vite/scripts/sync-package-docs.mjs`
- `packages/create-weapp-vite/src/agents.ts`
- `packages/create-weapp-vite/src/skills.ts`
- `docs/integration/react.md`
- `website/guide/multi-platform.md`
- `skills/*/SKILL.md`

## 再查受影响的公开入口

先确定已有正文所在页，再核对其他入口的链接和摘要。以下路径用于定位。

- `website/guide/ai.md`
- `website/guide/skills.md`
- `website/guide/ai-workflows.md`
- `website/guide/cli.md`
- `website/packages/*.md`
- `website/config/**`
- `website/.vitepress/components/AiLearningPage.vue`
- `website/.vitepress/config.ts`
- `README.md`
- `AGENTS.md`
- `CLAUDE.md`

## 技能与生成资产

- `skills/skill-trigger-regression-checklist.md`
- `skills/scripts/score-skill-trigger-regression.mjs`
- `skills/scripts/validate-skills-yaml.mjs`
- `skills/scripts/check-public-skill-sync.mjs`
- `website/public/llms-index.json`
- `website/public/seo-quality-report.json`

## 高频同步场景

### 新增或调整 skill

- 核对 `SKILL.md`、`agents/openai.yaml` 和分发配置与实际安装结果。
- 安装或触发契约变化时更新技能入口、触发回归清单和 `skills/scripts/score-skill-trigger-regression.mjs`。
- 检查网站、`AGENTS.md`、`CLAUDE.md` 与脚手架是否引用了变更的名称或链接，按需更新。

### CLI / MCP / AI 能力变化

- 命令说明以 `website/guide/cli.md` 或对应包页面为入口。AI 指南和学习页中的示例只有在引用的命令或行为变化时才更新。
- 核对 `wv prepare`、`wv mcp init|print|doctor`、`wv screenshot/compare`、`wv ide logs --open` 等受影响的命令。

### React / JSX / 多平台 / mpcore 变化

- React 以配置类型、React plugin、`@weapp-vite/react` runtime 和 React 模板为事实源。
- 区分 React owner 与 Wevu JSX/TSX，不把同一扩展名写成可在单次构建中混用。
- 多平台说明必须保留单目标构建、原生扩展名和目标 IDE/真机验收边界。
- touched DevTools 场景同步检查 headless provider 与 mpcore 三层覆盖。

### 随包 docs 变化

- 先改 `packages/weapp-vite/docs/**` 源文件
- 确认 `packages/weapp-vite/scripts/sync-package-docs.mjs` 的 `docEntries` 包含新增文档
- 通过包构建或同步脚本刷新 `packages/weapp-vite/dist/docs/**`
- 站点里只引用稳定的 `node_modules/weapp-vite/dist/docs/*.md` 路径，不引用本机绝对路径

### Website 构建后

- `llms-index.json` 已刷新
- `seo-quality-report.json` 已刷新
- 无 VitePress 构建错误
