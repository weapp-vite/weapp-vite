import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const repoRoot = path.resolve(import.meta.dirname, '..')
const ignoredDirectoryNames = new Set([
  '.git',
  '.pnpm-store',
  '.tmp',
  'node_modules',
])

/**
 * @description 解析命令行参数。
 */
function parseArgs(argv) {
  const check = argv.includes('--check')
  const files = argv.filter(arg => arg !== '--check')

  return {
    check,
    files,
  }
}

/**
 * @description 规范化 project 配置文件末尾换行。
 */
function normalizeProjectConfigEof(content) {
  return content.replace(/(?:\r?\n)+$/u, '')
}

/**
 * @description 解析待处理文件列表。
 */
async function collectProjectConfigFiles(root, currentDir = '') {
  const absoluteCurrentDir = path.join(root, currentDir)
  const entries = await fs.readdir(absoluteCurrentDir, {
    withFileTypes: true,
  })
  const files = []

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredDirectoryNames.has(entry.name)) {
        continue
      }

      files.push(...await collectProjectConfigFiles(root, path.join(currentDir, entry.name)))
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    if (entry.name === 'project.config.json' || entry.name === 'project.private.config.json') {
      files.push(path.join(currentDir, entry.name))
    }
  }

  return files
}

async function resolveTargetFiles(files) {
  if (files.length > 0) {
    return files
  }

  return await collectProjectConfigFiles(repoRoot)
}

/**
 * @description 执行末尾换行修正或检查。
 */
async function main() {
  const { check, files } = parseArgs(process.argv.slice(2))
  const targetFiles = await resolveTargetFiles(files)
  const changedFiles = []

  for (const relativeFilePath of targetFiles) {
    const absoluteFilePath = path.resolve(repoRoot, relativeFilePath)
    const content = await fs.readFile(absoluteFilePath, 'utf8')
    const normalizedContent = normalizeProjectConfigEof(content)

    if (normalizedContent === content) {
      continue
    }

    changedFiles.push(relativeFilePath)

    if (!check) {
      await fs.writeFile(absoluteFilePath, normalizedContent, 'utf8')
    }
  }

  if (check && changedFiles.length > 0) {
    console.error('[fix-wechat-devtools-project-config-eof] files still contain trailing newline:')
    for (const changedFile of changedFiles) {
      console.error(changedFile)
    }
    process.exitCode = 1
    return
  }

  console.log(`[fix-wechat-devtools-project-config-eof] ${check ? 'checked' : 'updated'} ${changedFiles.length} files`)
}

await main()
