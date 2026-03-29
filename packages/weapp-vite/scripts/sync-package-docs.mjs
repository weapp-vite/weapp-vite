import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(moduleDir, '..')
const outputDir = path.join(packageRoot, 'dist', 'docs')

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
]

function createIndex(entries) {
  const lines = [
    '# weapp-vite dist docs',
    '',
    '这个目录会随 `weapp-vite` npm 包一起发布，供 AI 代理和开发者优先读取与当前包版本匹配的本地文档。',
    '',
    '推荐顺序：',
    '',
    '1. 先读 `README.md` 获取总体能力与推荐命令。',
    '2. 涉及 AI / MCP / screenshot 验收时读 `mcp.md`。',
    '3. 涉及编辑器智能提示时读 `volar.md`。',
    '4. 涉及 `vite.config.ts` 类型推导时读 `define-config-overloads.md`。',
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
