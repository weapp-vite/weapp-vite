import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'

const CRLF_RE = /\r\n/g
const WINDOWS_VERBATIM_PATH_RE = /^\\\\\?\\/

function normalizeTemplatePath(value: string) {
  return value.replace(WINDOWS_VERBATIM_PATH_RE, '').split('\\').join('/')
}

function normalizeTemplateRelativePath(relativePath: string) {
  if (!relativePath || relativePath === '.') {
    return ''
  }

  return normalizeTemplatePath(relativePath)
}

function isGeneratedOutputSegment(segment: string) {
  return segment === 'dist' || segment.startsWith('dist-')
}

function hasTemplatePathSegment(relativePath: string, predicate: (segment: string) => boolean) {
  return relativePath.split('/').some(predicate)
}

export function shouldSkipTemplateFile(filePath: string, templateRoot: string) {
  const relativePath = normalizeTemplateRelativePath(
    path.relative(normalizeTemplatePath(templateRoot), normalizeTemplatePath(filePath)),
  )

  if (!relativePath) {
    return false
  }

  return (
    hasTemplatePathSegment(relativePath, segment => segment === 'node_modules')
    || hasTemplatePathSegment(relativePath, segment => segment === '.weapp-vite')
    || hasTemplatePathSegment(relativePath, isGeneratedOutputSegment)
    || hasTemplatePathSegment(relativePath, segment => segment === '.turbo')
    || hasTemplatePathSegment(relativePath, segment => segment === '.npmrc')
    || relativePath === 'vite.config.ts.timestamp'
    || relativePath.endsWith('/vite.config.ts.timestamp')
    || relativePath === 'CHANGELOG.md'
    || relativePath === 'AGENTS.md'
    || relativePath.endsWith('/CHANGELOG.md')
    || relativePath === '.DS_Store'
    || relativePath.endsWith('/.DS_Store')
  )
}

function normalizeLines(value: string) {
  return value.replace(CRLF_RE, '\n').split('\n')
}

export function mergeGitignoreSource(existing: string, template: string) {
  const merged = normalizeLines(existing)
  const seen = new Set(merged)

  for (const line of normalizeLines(template)) {
    if (seen.has(line)) {
      continue
    }
    merged.push(line)
    seen.add(line)
  }

  while (merged.length > 0 && merged[merged.length - 1] === '') {
    merged.pop()
  }

  return `${merged.join('\n')}\n`
}

export async function copyTemplateDir(sourceDir: string, fallbackDir: string, targetDir: string) {
  const copyOptions = {
    filter(src: string) {
      return !shouldSkipTemplateFile(src, sourceDir)
    },
  }

  try {
    await fs.copy(sourceDir, targetDir, copyOptions)
  }
  catch (error) {
    const errorCode = (error as NodeJS.ErrnoException | undefined)?.code
    if (sourceDir === fallbackDir || errorCode !== 'ENOENT') {
      throw error
    }
    await fs.copy(fallbackDir, targetDir, copyOptions)
  }
}

export async function ensureDotGitignore(root: string) {
  const gitignorePath = path.resolve(root, 'gitignore')
  const dotGitignorePath = path.resolve(root, '.gitignore')

  if (!await fs.pathExists(gitignorePath)) {
    return
  }

  if (await fs.pathExists(dotGitignorePath)) {
    await fs.remove(gitignorePath)
    return
  }

  await fs.move(gitignorePath, dotGitignorePath)
}
