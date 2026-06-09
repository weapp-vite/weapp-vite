import type { CompilerContext } from '../../../context'
import { normalizeAppJson } from '../../../utils'
import { resolveRelativeJsonOutputFileName } from '../../utils/outputFileName'

export interface JsonEmitFileEntry {
  fileName?: string
  jsonPath?: string
  json: any
  type: 'app' | 'page' | 'component' | 'plugin'
}

export interface JsonEmitRecord {
  fileName: string
  entry: Required<JsonEmitFileEntry>
}

export function createJsonEmitManager(
  configService: CompilerContext['configService'],
) {
  const map = new Map<string, JsonEmitRecord>()

  function register(entry: JsonEmitFileEntry) {
    if (!entry.jsonPath && !entry.fileName) {
      return
    }

    const fileName = entry.fileName ?? resolveRelativeJsonOutputFileName(configService, entry.jsonPath!)
    const shouldNormalizeAppJson = entry.type === 'app' && fileName === 'app.json'
    const normalizedEntry = shouldNormalizeAppJson
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
