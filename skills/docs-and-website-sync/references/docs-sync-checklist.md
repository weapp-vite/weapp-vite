# Docs Sync Checklist

## 推荐检查顺序

1. 真实能力入口

- `package.json`
- `packages/*/README.md`
- `packages/weapp-vite/src/cli/**`
- `skills/*/SKILL.md`

2. 文档入口

- `website/guide/ai.md`
- `website/guide/cli.md`
- `website/packages/*.md`
- `website/.vitepress/components/AiLearningPage.vue`
- `README.md`
- `CLAUDE.md`

3. 技能治理入口

- `skills/skill-trigger-regression-checklist.md`
- `skills/scripts/score-skill-trigger-regression.mjs`
- `skills/scripts/validate-skills-yaml.mjs`

4. 生成资产

- `website/public/llms-index.json`
- `website/public/seo-quality-report.json`

## 常见同步场景

### 新增 skill

- 补 `skills/<name>/SKILL.md`
- 补 `skills/<name>/agents/openai.yaml`
- 视需要补 `references/*`
- 更新 AI 入口页与本地技能链接说明
- 更新触发回归清单与评分脚本

### CLI / MCP 能力变化

- 更新 `website/guide/cli.md`
- 更新 `website/guide/ai.md`
- 更新 `website/packages/mcp.md`
- 刷新 AI 学习页组件中的命令示例

### 网站构建后检查

- `llms-index.json` 已刷新
- `seo-quality-report.json` 已刷新
- 无 VitePress 构建错误
