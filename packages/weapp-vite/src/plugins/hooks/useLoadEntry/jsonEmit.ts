import type { CompilerContext } from '../../../context'
import { resolveRelativeJsonOutputFileName } from '../../utils/outputFileName'

export interface JsonEmitFileEntry {
  jsonPath?: string
  json: any
  type: 'app' | 'page' | 'component' | 'plugin'
}

export interface JsonEmitRecord {
  fileName: string
  entry: Required<JsonEmitFileEntry>
}

function normalizeAppJson(json: any) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return json
  }

  const subPackages = Array.isArray(json.subPackages)
    ? json.subPackages
    : Array.isArray(json.subpackages)
      ? json.subpackages
      : []

  return {
    ...json,
    subPackages: subPackages.map(subPackage => ({
      ...subPackage,
      pages: Array.isArray(subPackage?.pages) ? subPackage.pages : [],
    })),
  }
}

export function createJsonEmitManager(
  configService: CompilerContext['configService'],
) {
  const map = new Map<string, JsonEmitRecord>()

  function register(entry: JsonEmitFileEntry) {
    if (!entry.jsonPath) {
      return
    }

    const fileName = resolveRelativeJsonOutputFileName(configService, entry.jsonPath)
    const normalizedEntry = entry.type === 'app'
      ? {
          ...entry,
          json: normalizeAppJson(entry.json),
        }
      : entry

    map.set(fileName, {
      fileName,
      entry: normalizedEntry as Required<JsonEmitFileEntry>,
    })
  }

  return {
    map,
    register,
  }
}
