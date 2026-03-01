import fs from 'node:fs/promises'
import path from 'node:path'
import { DEFAULT_MAX_FILE_CHARS, DEFAULT_MAX_RESULTS, SKIPPED_DIR_NAMES } from './constants'
import { assertInsideRoot, resolveSubPath } from './workspace'

export interface SearchMatch {
  filePath: string
  line: number
  column: number
  text: string
}

async function walkFilesRecursive(root: string, current: string, output: string[], maxResults: number) {
  if (output.length >= maxResults) {
    return
  }

  const entries = await fs.readdir(current, { withFileTypes: true })
  for (const entry of entries) {
    if (output.length >= maxResults) {
      return
    }
    if (entry.isDirectory()) {
      if (SKIPPED_DIR_NAMES.has(entry.name)) {
        continue
      }
      await walkFilesRecursive(root, path.join(current, entry.name), output, maxResults)
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    const absolutePath = path.join(current, entry.name)
    const relativePath = path.relative(root, absolutePath).split(path.sep).join('/')
    output.push(relativePath)
  }
}

export async function listFilesInDirectory(root: string, relativeDirectory = '.', maxResults = DEFAULT_MAX_RESULTS) {
  const dirPath = resolveSubPath(root, relativeDirectory)
  const files: string[] = []
  await walkFilesRecursive(root, dirPath, files, maxResults)
  return files
}

function sliceLines(content: string, startLine?: number, endLine?: number) {
  if (!startLine && !endLine) {
    return content
  }
  const lines = content.split('\n')
  const safeStart = Math.max(1, startLine ?? 1)
  const safeEnd = Math.max(safeStart, endLine ?? lines.length)
  return lines.slice(safeStart - 1, safeEnd).join('\n')
}

export async function readFileContent(
  root: string,
  relativeFilePath: string,
  options?: {
    startLine?: number
    endLine?: number
    maxChars?: number
  },
) {
  const filePath = assertInsideRoot(root, path.join(root, relativeFilePath))
  const content = await fs.readFile(filePath, 'utf8')
  const selected = sliceLines(content, options?.startLine, options?.endLine)
  const maxChars = options?.maxChars ?? DEFAULT_MAX_FILE_CHARS
  const clipped = selected.length > maxChars
    ? `${selected.slice(0, maxChars)}\n\n[truncated: ${selected.length - maxChars} chars omitted]`
    : selected

  return {
    filePath,
    content: clipped,
  }
}

function collectMatchesFromText(
  query: string,
  relativeFilePath: string,
  content: string,
  maxResults: number,
  output: SearchMatch[],
) {
  const lines = content.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    if (output.length >= maxResults) {
      return
    }
    const lineText = lines[index] ?? ''
    const column = lineText.toLowerCase().indexOf(query.toLowerCase())
    if (column === -1) {
      continue
    }
    output.push({
      filePath: relativeFilePath,
      line: index + 1,
      column: column + 1,
      text: lineText.trim(),
    })
  }
}

export async function searchTextInDirectory(
  root: string,
  query: string,
  options?: {
    relativeDirectory?: string
    maxResults?: number
  },
) {
  const maxResults = options?.maxResults ?? DEFAULT_MAX_RESULTS
  const files = await listFilesInDirectory(root, options?.relativeDirectory ?? '.', Math.max(400, maxResults))
  const matches: SearchMatch[] = []

  for (const file of files) {
    if (matches.length >= maxResults) {
      break
    }
    const absolutePath = path.join(root, file)
    let content = ''
    try {
      content = await fs.readFile(absolutePath, 'utf8')
    }
    catch {
      continue
    }
    collectMatchesFromText(query, file, content, maxResults, matches)
  }

  return matches
}
