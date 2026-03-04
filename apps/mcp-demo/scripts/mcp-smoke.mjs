import fs from 'node:fs/promises'
import path from 'node:path'

const projectRoot = process.cwd()

const checks = [
  {
    label: 'index page template output',
    file: path.join(projectRoot, 'dist', 'pages', 'index', 'index.wxml'),
    contains: '检查点',
  },
  {
    label: 'index page runtime output',
    file: path.join(projectRoot, 'dist', 'pages', 'index', 'index.js'),
    contains: 'MCP AI 调用测试场',
  },
  {
    label: 'app manifest output',
    file: path.join(projectRoot, 'dist', 'app.json'),
    contains: 'pages/index/index',
  },
]

const results = []

for (const item of checks) {
  try {
    const content = await fs.readFile(item.file, 'utf8')
    const matched = content.includes(item.contains)
    results.push({
      label: item.label,
      file: path.relative(projectRoot, item.file),
      exists: true,
      matched,
      expectedSnippet: item.contains,
    })
  }
  catch {
    results.push({
      label: item.label,
      file: path.relative(projectRoot, item.file),
      exists: false,
      matched: false,
      expectedSnippet: item.contains,
    })
  }
}

const failed = results.filter(item => !item.exists || !item.matched)

process.stdout.write(`${JSON.stringify({ pass: failed.length === 0, results }, null, 2)}\n`)

if (failed.length > 0) {
  process.exitCode = 1
}
