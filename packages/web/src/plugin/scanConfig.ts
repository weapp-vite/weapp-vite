import type { WarnFn } from './types'
import { readJsonFile, resolveJsonPath } from './files'

interface CollectComponentTagsFromConfigOptions {
  json: Record<string, unknown>
  importerDir: string
  jsonPath: string
  warn: WarnFn
  resolveComponentScript: (raw: string, importerDir: string) => Promise<string | undefined>
  getComponentTag: (script: string) => string
  collectComponent: (componentId: string, importerDir: string) => Promise<void>
  onResolved?: (tags: Record<string, string>) => void
}

export async function collectComponentTagsFromConfig({
  json,
  importerDir,
  jsonPath,
  warn,
  resolveComponentScript,
  getComponentTag,
  collectComponent,
  onResolved,
}: CollectComponentTagsFromConfigOptions) {
  const usingComponents = json.usingComponents
  if (!usingComponents || typeof usingComponents !== 'object') {
    return {}
  }

  const tags: Record<string, string> = {}
  const resolved: Array<{ rawValue: string }> = []

  for (const [rawKey, rawValue] of Object.entries(usingComponents)) {
    if (typeof rawValue !== 'string') {
      continue
    }
    const key = normalizeComponentKey(rawKey)
    if (!key) {
      continue
    }
    const script = await resolveComponentScript(rawValue, importerDir)
    if (!script) {
      warn(`[@weapp-vite/web] usingComponents entry "${rawKey}" not found: ${rawValue} (${jsonPath})`)
      continue
    }
    const tag = getComponentTag(script)
    tags[key] = tag
    resolved.push({ rawValue })
  }

  onResolved?.(tags)
  for (const entry of resolved) {
    await collectComponent(entry.rawValue, importerDir)
  }

  return tags
}

interface CollectComponentTagsFromJsonOptions {
  jsonBasePath: string
  importerDir: string
  warn: WarnFn
  collectFromConfig: (json: Record<string, unknown>, importerDir: string, jsonPath: string, warn: WarnFn) => Promise<Record<string, string>>
}

export async function collectComponentTagsFromJson({
  jsonBasePath,
  importerDir,
  warn,
  collectFromConfig,
}: CollectComponentTagsFromJsonOptions) {
  const resolvedPath = await resolveJsonPath(jsonBasePath)
  if (!resolvedPath) {
    return {}
  }
  const json = await readJsonFile(resolvedPath)
  if (!json) {
    return {}
  }
  return collectFromConfig(json, importerDir, resolvedPath, warn)
}

export function mergeComponentTags(base: Record<string, string>, overrides: Record<string, string>) {
  if (!Object.keys(base).length && !Object.keys(overrides).length) {
    return {}
  }
  return {
    ...base,
    ...overrides,
  }
}

function normalizeComponentKey(raw: string) {
  return raw.trim().toLowerCase()
}
