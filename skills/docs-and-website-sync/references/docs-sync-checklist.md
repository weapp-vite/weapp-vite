# Docs Sync Checklist

## 先查事实来源

- `package.json`
- `packages/*/README.md`
- `packages/weapp-vite/src/cli/**`
- `packages/weapp-vite/src/types/config/**`
- `packages/weapp-vite/docs/README.md`
- `packages/weapp-vite/docs/mcp.md`
- `packages/weapp-vite/docs/volar.md`
- `packages/weapp-vite/docs/define-config-overloads.md`
- `packages/weapp-vite/docs/packaged/**`
- `packages/weapp-vite/scripts/sync-package-docs.mjs`
- `packages/create-weapp-vite/src/agents.ts`
- `packages/create-weapp-vite/src/skills.ts`
- `skills/*/SKILL.md`

## 再查公开入口

- `website/guide/ai.md`
- `website/guide/skills.md`
- `website/guide/ai-workflows.md`
- `website/guide/cli.md`
- `website/packages/*.md`
- `website/config/**`
- `website/.vitepress/components/AiLearningPage.vue`
- `website/.vitepress/config.ts`
- `README.md`
- `CLAUDE.md`

## 技能与生成资产

- `skills/skill-trigger-regression-checklist.md`
- `skills/scripts/score-skill-trigger-regression.mjs`
- `skills/scripts/validate-skills-yaml.mjs`
- `website/public/llms-index.json`
- `website/public/seo-quality-report.json`

## 高频同步场景

### 新增或调整 skill

- 补 `skills/<name>/SKILL.md`
- 补 `skills/<name>/agents/openai.yaml`
- 只在需要时补 `references/*`
- 更新 AI 入口页与本地 skills 安装说明
- 更新 skill 触发回归清单
- 更新 `skills/scripts/score-skill-trigger-regression.mjs` 的预期映射与统计分组
- 更新 `website/guide/skills.md`、`website/guide/ai-workflows.md` 与 `/ai` 可视化入口
- 移除已经合并进其他 skill 的旧名称，避免用户复制后调用失败

### CLI / MCP / AI 能力变化

- 更新 `website/guide/cli.md`
- 更新 `website/guide/ai.md`
- 更新 `website/guide/ai-workflows.md`
- 更新 `website/packages/mcp.md`
- 刷新 AI 学习页里的命令示例
- 对齐 `wv prepare`、`wv mcp init|print|doctor`、`wv screenshot`、`wv compare`、`wv ide logs --open`

### 随包 docs 变化

- 先改 `packages/weapp-vite/docs/**` 源文件
- 确认 `packages/weapp-vite/scripts/sync-package-docs.mjs` 的 `docEntries` 包含新增文档
- 通过包构建或同步脚本刷新 `packages/weapp-vite/dist/docs/**`
- 站点里只引用稳定的 `node_modules/weapp-vite/dist/docs/*.md` 路径，不引用本机绝对路径

### Website 构建后

- `llms-index.json` 已刷新
- `seo-quality-report.json` 已刷新
- 无 VitePress 构建错误
