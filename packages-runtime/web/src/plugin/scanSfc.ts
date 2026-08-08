import type { ModuleMeta, ResolveWebAutoImportTag, ResolveWebModuleId, ScanState } from './types'
import { readdir, readFile } from 'node:fs/promises'
import path from 'pathe'
import { SCRIPT_EXTS } from './constants'
import { isRecord, resolveTemplateFile } from './files'
import { compileWebVueSfc } from './vueSfc'

const PAGE_SEGMENT = 'pages'
const EXCLUDED_PAGE_SEGMENTS = new Set(['components', 'custom-tab-bar', 'layouts'])

export function parseSfcJsonConfig(source?: string) {
  if (!source) {
    return undefined
  }
  try {
    const parsed = JSON.parse(source) as unknown
    return isRecord(parsed) ? parsed : undefined
  }
  catch {
    return undefined
  }
}

export async function compileScannedSfc(options: {
  filename: string
  meta: ModuleMeta
  srcRoot: string
  state: ScanState
  resolveId?: ResolveWebModuleId
  resolveAutoImportTag?: ResolveWebAutoImportTag
  uniApp?: { include: string[] }
}) {
  const source = await readFile(options.filename, 'utf8')
  const result = await compileWebVueSfc({ ...options, source })
  return {
    result,
    config: parseSfcJsonConfig(result.config),
  }
}

function isPageCandidate(relativePath: string) {
  const segments = relativePath.split('/')
  const pagesIndex = segments.indexOf(PAGE_SEGMENT)
  if (pagesIndex < 0) {
    return false
  }
  const routeSegments = segments.slice(pagesIndex + 1, -1)
  return !routeSegments.some(segment => EXCLUDED_PAGE_SEGMENTS.has(segment))
}

async function walk(current: string, files: string[]) {
  const entries = await readdir(current, { withFileTypes: true })
  for (const entry of entries) {
    const pathname = path.join(current, entry.name)
    if (entry.isDirectory()) {
      await walk(pathname, files)
    }
    else {
      files.push(pathname)
    }
  }
}

export async function discoverWebPageIds(srcRoot: string) {
  const files: string[] = []
  await walk(srcRoot, files)
  const pageIds = new Set<string>()
  for (const filename of files.sort()) {
    const extension = path.extname(filename)
    if (!SCRIPT_EXTS.includes(extension)) {
      continue
    }
    const relativePath = path.relative(srcRoot, filename).replaceAll('\\', '/')
    if (!isPageCandidate(relativePath)) {
      continue
    }
    if (extension !== '.vue' && !(await resolveTemplateFile(filename))) {
      continue
    }
    pageIds.add(relativePath.slice(0, -extension.length))
  }
  return [...pageIds]
}
