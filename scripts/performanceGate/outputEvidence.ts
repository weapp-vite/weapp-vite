import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { verifyBenchmarkAppOutputs } from '../benchmarkTemplatesPerformance/appOutputs'

export interface OutputEvidence {
  pageCount: number
  templateDigest: string
  configDigest: string
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical)
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)]))
  }
  return value
}

/** 在计时外固定页面集合、模板内容与配置证据；不依赖 JS 压缩变量或 chunk hash。 */
export async function captureOutputEvidence(root: string): Promise<OutputEvidence> {
  const checked = await verifyBenchmarkAppOutputs(root)
  const directory = path.join(root, 'dist')
  const manifest = JSON.parse(await readFile(path.join(directory, 'app.json'), 'utf8')) as { pages: string[], subPackages?: Array<{ root: string, pages: string[] }>, subpackages?: Array<{ root: string, pages: string[] }> }
  const pages = [...manifest.pages, ...(manifest.subPackages ?? manifest.subpackages ?? []).flatMap(sub => sub.pages.map(page => path.posix.join(sub.root, page)))].sort()
  const templates = createHash('sha256')
  const configs = createHash('sha256').update(JSON.stringify(canonical(manifest)))
  for (const page of pages) {
    templates.update(JSON.stringify(page))
    templates.update(await readFile(path.join(directory, `${page}.wxml`)))
    configs.update(JSON.stringify(page))
    configs.update(JSON.stringify(canonical(JSON.parse(await readFile(path.join(directory, `${page}.json`), 'utf8')) as unknown)))
  }
  return { pageCount: checked.pageCount, templateDigest: templates.digest('hex'), configDigest: configs.digest('hex') }
}

export function isOutputEvidence(value: unknown): value is OutputEvidence {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Record<string, unknown>
  return Number.isInteger(candidate.pageCount) && Number(candidate.pageCount) > 0
    && [candidate.templateDigest, candidate.configDigest].every(digest => typeof digest === 'string' && /^[a-f0-9]{64}$/.test(digest))
}
