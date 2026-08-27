import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT_DIR = path.resolve(import.meta.dirname, '..')

const CHECK_TARGETS = [
  {
    directory: 'src',
    maxLines: 300,
  },
  {
    directory: 'test',
    maxLines: 300,
  },
]

const SOURCE_EXTENSIONS = new Set(['.ts', '.mts', '.js', '.mjs'])
const PART_FILE_NAME_PATTERN = /(?:^|[a-z])part\d+$/i

/**
 * @description 递归收集目录下需要校验的源码文件。
 */
async function collectSourceFiles(directory) {
  const files = []
  const entries = await fs.readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(fullPath))
      continue
    }
    if (!entry.isFile()) {
      continue
    }
    const extension = path.extname(entry.name)
    if (!SOURCE_EXTENSIONS.has(extension)) {
      continue
    }
    files.push(fullPath)
  }
  return files
}

/**
 * @description 统计文件真实行数（保留空行，避免与编辑器显示差异）。
 */
function getLineCount(text) {
  if (text.length === 0) {
    return 0
  }
  return text.split('\n').length
}

async function run() {
  const lineViolations = []
  const nameViolations = []

  for (const target of CHECK_TARGETS) {
    const baseDirectory = path.join(ROOT_DIR, target.directory)
    const files = await collectSourceFiles(baseDirectory)
    for (const filePath of files) {
      const relativePath = path.relative(ROOT_DIR, filePath)
      const parsed = path.parse(filePath)
      if (PART_FILE_NAME_PATTERN.test(parsed.name)) {
        nameViolations.push(relativePath)
      }

      const sourceText = await fs.readFile(filePath, 'utf8')
      const lineCount = getLineCount(sourceText)
      if (lineCount > target.maxLines) {
        lineViolations.push({
          path: relativePath,
          lines: lineCount,
          max: target.maxLines,
        })
      }
    }
  }

  if (nameViolations.length === 0 && lineViolations.length === 0) {
    console.log('[weapi-structure-guard] check passed')
    return
  }

  console.error('[weapi-structure-guard] check failed')

  if (nameViolations.length > 0) {
    console.error('- 发现无语义 Part 文件名（请改为语义化名称）:')
    for (const filePath of nameViolations) {
      console.error(`  - ${filePath}`)
    }
  }

  if (lineViolations.length > 0) {
    console.error('- 发现超行数文件（请继续拆分）:')
    for (const item of lineViolations) {
      console.error(`  - ${item.path}: ${item.lines} 行（上限 ${item.max}）`)
    }
  }

  process.exitCode = 1
}

run().catch((error) => {
  console.error('[weapi-structure-guard] check failed with exception')
  console.error(error)
  process.exitCode = 1
})
