import fs from 'node:fs/promises'
import path from 'node:path'

export const CHANGESET_DIR = '.changeset'
export const CHANGESET_README = 'README.md'

export function extractChangesetPackages(content: string) {
  const lines = content.split('\n')
  let start = -1
  let end = -1

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]?.trim()
    if (line === '---') {
      if (start === -1) {
        start = i
      }
      else {
        end = i
        break
      }
    }
  }

  if (start === -1 || end === -1 || end <= start + 1) {
    return []
  }

  const packages = new Set<string>()
  for (let i = start + 1; i < end; i += 1) {
    const trimmed = lines[i]?.trim()
    if (!trimmed) {
      continue
    }
    const colonIndex = trimmed.indexOf(':')
    if (colonIndex <= 0) {
      continue
    }
    let key = trimmed.slice(0, colonIndex).trim()
    if (
      (key.startsWith('"') && key.endsWith('"'))
      || (key.startsWith('\'') && key.endsWith('\''))
    ) {
      key = key.slice(1, -1)
    }
    if (key) {
      packages.add(key)
    }
  }

  return [...packages]
}

export async function collectChangesetPackages(changedChangesetFiles: string[]) {
  const changesetPackages = new Set<string>()

  for (const file of changedChangesetFiles) {
    try {
      const content = await fs.readFile(file, 'utf8')
      for (const pkg of extractChangesetPackages(content)) {
        changesetPackages.add(pkg)
      }
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue
      }
      throw error
    }
  }

  return changesetPackages
}

export function hasReleaseArtifactsForPackage(changedFiles: string[], packageDir: string) {
  const normalizedDir = packageDir.replaceAll('\\', '/').replace(/\/$/, '')
  const expectedFiles = new Set([
    `${normalizedDir}/package.json`,
    `${normalizedDir}/CHANGELOG.md`,
  ])

  return changedFiles.some(file => expectedFiles.has(file.replaceAll('\\', '/')))
}

export function hasNonReleaseArtifactTemplateChange(changedFiles: string[]) {
  return changedFiles.some((file) => {
    const normalizedFile = file.replaceAll('\\', '/')
    if (!normalizedFile.startsWith('templates/')) {
      return false
    }

    const baseName = path.posix.basename(normalizedFile)
    return baseName !== 'package.json' && baseName !== 'CHANGELOG.md'
  })
}

/**
 * 列出 changeset 目录中除 README 外的 markdown 文件。
 */
export async function listChangesetMarkdownFiles(changesetDir = CHANGESET_DIR) {
  try {
    const entries = await fs.readdir(changesetDir, { withFileTypes: true })
    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.md') && entry.name !== CHANGESET_README)
      .map(entry => path.join(changesetDir, entry.name))
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }
}

/**
 * 读取全部现有 changeset 中的包名，不排除自动生成文件。
 */
export async function collectAllChangesetPackages(changesetDir = CHANGESET_DIR) {
  return collectChangesetPackages(await listChangesetMarkdownFiles(changesetDir))
}

/**
 * 把时间格式化成本地 `YYYYMMDD-HHmmss`，用于自动 changeset 文件名。
 */
export function formatChangesetTimestamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`,
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`,
  ].join('-')
}

/**
 * 为自动生成的 changeset 分配不会覆盖已有文件的路径。
 */
export function allocateUniqueChangesetPath(options: {
  changesetDir?: string
  prefix: string
  existingNames: Iterable<string>
  now?: Date
}) {
  const changesetDir = options.changesetDir ?? CHANGESET_DIR
  const existing = new Set([...options.existingNames].map(name => path.basename(name)))
  const timestamp = formatChangesetTimestamp(options.now ?? new Date())
  const baseName = `${options.prefix}-${timestamp}.md`
  if (!existing.has(baseName)) {
    return path.join(changesetDir, baseName)
  }

  let suffix = 2
  while (existing.has(`${options.prefix}-${timestamp}-${suffix}.md`)) {
    suffix += 1
  }
  return path.join(changesetDir, `${options.prefix}-${timestamp}-${suffix}.md`)
}

/**
 * 组装 changeset markdown，frontmatter 按包名排序。
 */
export function formatChangesetMarkdown(packages: string[], bumpType: string, body: string) {
  const frontmatter = [...new Set(packages)]
    .sort()
    .map(pkg => `'${pkg}': ${bumpType}`)
    .join('\n')
  const normalizedBody = body.endsWith('\n') ? body : `${body}\n`
  return `---
${frontmatter}
---

${normalizedBody}`
}

/**
 * 写入一份新的自动 changeset，绝不覆盖或删除已有文件。
 */
export async function writeUniqueChangeset(options: {
  changesetDir?: string
  prefix: string
  packages: string[]
  bumpType: string
  body: string
  now?: Date
}) {
  if (options.packages.length === 0) {
    throw new Error('writeUniqueChangeset requires at least one package')
  }

  const changesetDir = options.changesetDir ?? CHANGESET_DIR
  await fs.mkdir(changesetDir, { recursive: true })
  const targetPath = allocateUniqueChangesetPath({
    changesetDir,
    prefix: options.prefix,
    existingNames: await listChangesetMarkdownFiles(changesetDir),
    now: options.now,
  })
  await fs.writeFile(
    targetPath,
    formatChangesetMarkdown(options.packages, options.bumpType, options.body),
    'utf8',
  )
  return targetPath
}
