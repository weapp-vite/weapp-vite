import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(moduleDir, '..')
const outputDir = path.join(packageRoot, 'dist', 'docs')
const packagedDocsDir = path.join(packageRoot, 'docs', 'packaged')

const docEntries = [
  {
    source: path.join(packageRoot, 'README.md'),
    output: 'README.md',
    title: 'weapp-vite Package Docs',
    summary: 'weapp-vite npm 包内置文档入口，供 AI 与开发者优先读取本地版本说明。',
  },
  {
    source: path.join(packageRoot, 'docs', 'mcp.md'),
    output: 'mcp.md',
    title: 'MCP Guide',
    summary: 'MCP、AI 工作流与 screenshot 验收说明。',
  },
  {
    source: path.join(packageRoot, 'docs', 'volar.md'),
    output: 'volar.md',
    title: 'Volar Guide',
    summary: 'Volar、JSON 宏与编辑器智能提示支持说明。',
  },
  {
    source: path.join(packageRoot, 'docs', 'define-config-overloads.md'),
    output: 'define-config-overloads.md',
    title: 'defineConfig Overloads',
    summary: 'defineConfig 类型重载与配置推导说明。',
  },
  {
    source: path.join(packagedDocsDir, 'getting-started.md'),
    output: 'getting-started.md',
    title: 'Getting Started',
    summary: 'CLI 命令、prepare、build、screenshot、MCP 等快速入口。',
  },
  {
    source: path.join(packagedDocsDir, 'ai-workflows.md'),
    output: 'ai-workflows.md',
    title: 'AI Workflows',
    summary: 'AI 代理在其他仓库里使用 weapp-vite 的推荐工作流。',
  },
  {
    source: path.join(packagedDocsDir, 'project-structure.md'),
    output: 'project-structure.md',
    title: 'Project Structure',
    summary: 'AGENTS.md、.weapp-vite、dist 与源码目录的职责说明。',
  },
  {
    source: path.join(packagedDocsDir, 'weapp-config.md'),
    output: 'weapp-config.md',
    title: 'Weapp Config',
    summary: 'weapp 配置、autoRoutes、autoImportComponents、routeRules 与 chunk 策略。',
  },
  {
    source: path.join(packagedDocsDir, 'wevu-authoring.md'),
    output: 'wevu-authoring.md',
    title: 'Wevu Authoring',
    summary: 'wevu 页面、组件、store、router 与事件契约的推荐写法。',
  },
  {
    source: path.join(packagedDocsDir, 'vue-sfc.md'),
    output: 'vue-sfc.md',
    title: 'Vue SFC',
    summary: 'definePageJson、definePageMeta、v-model 与模板兼容约束。',
  },
  {
    source: path.join(packagedDocsDir, 'troubleshooting.md'),
    output: 'troubleshooting.md',
    title: 'Troubleshooting',
    summary: 'prepare、截图、日志、wevu 依赖与 dist 同步等常见排障。',
  },
]

function createIndex(entries) {
  const lines = [
    '# weapp-vite dist docs',
    '',
    '这个目录会随 `weapp-vite` npm 包一起发布，供 AI 代理和开发者优先读取与当前包版本匹配的本地文档。',
    '',
    '这不是 `website` 的完整镜像，而是面向 AI 与离线开发场景的精简本地知识包。',
    '',
    '推荐顺序：',
    '',
    '1. 先读 `README.md` 与 `getting-started.md` 获取总体能力与常用命令。',
    '2. 涉及 AI / MCP / screenshot / DevTools logs 时读 `ai-workflows.md` 与 `mcp.md`。',
    '3. 涉及项目目录、`AGENTS.md`、`.weapp-vite` 时读 `project-structure.md`。',
    '4. 涉及 `vite.config.ts`、`weapp` 配置与 chunk 策略时读 `weapp-config.md`。',
    '5. 涉及 wevu 运行时与页面/组件/store 约束时读 `wevu-authoring.md`。',
    '6. 涉及 Vue SFC 宏、模板约束与编辑器提示时读 `vue-sfc.md`、`volar.md` 与 `define-config-overloads.md`。',
    '7. 遇到告警、prepare、截图、日志、依赖异常时读 `troubleshooting.md`。',
    '',
    '## Included Docs',
    '',
    ...entries.map(entry => `- \`${entry.output}\`: ${entry.summary}`),
    '',
  ]

  return `${lines.join('\n')}\n`
}

export async function syncPackageDocs() {
  await fs.mkdir(outputDir, { recursive: true })

  for (const entry of docEntries) {
    const content = await fs.readFile(entry.source, 'utf8')
    await fs.writeFile(path.join(outputDir, entry.output), content)
  }

  await fs.writeFile(path.join(outputDir, 'index.md'), createIndex(docEntries))
}
