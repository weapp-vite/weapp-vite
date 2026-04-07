import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const CHANGESET_DIR = join(process.cwd(), '.changeset')
const badFiles = []

for (const entry of readdirSync(CHANGESET_DIR, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name === 'README.md') {
    continue
  }

  const filePath = join(CHANGESET_DIR, entry.name)
  const content = readFileSync(filePath, 'utf8')

  if (!content.startsWith('---\n')) {
    badFiles.push(entry.name)
    continue
  }

  const closingIndex = content.indexOf('\n---\n', 4)

  if (closingIndex === -1) {
    badFiles.push(entry.name)
  }
}

if (badFiles.length > 0) {
  console.error('[changeset-frontmatter] 以下 changeset frontmatter 格式无效：')
  for (const file of badFiles) {
    console.error(`- .changeset/${file}`)
  }
  console.error('期望格式：文件必须以 --- 开头，并包含成对的 frontmatter 分隔线。')
  process.exit(1)
}

console.log(`[changeset-frontmatter] check passed (${CHANGESET_DIR})`)
