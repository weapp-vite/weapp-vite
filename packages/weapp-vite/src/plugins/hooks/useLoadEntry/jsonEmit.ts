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

export function createJsonEmitManager(
  configService: CompilerContext['configService'],
) {
  const map = new Map<string, JsonEmitRecord>()

  function register(entry: JsonEmitFileEntry) {
    if (!entry.jsonPath) {
      return
    }

    const fileName = resolveRelativeJsonOutputFileName(configService, entry.jsonPath)

    map.set(fileName, {
      fileName,
      entry: entry as Required<JsonEmitFileEntry>,
    })
  }

  return {
    map,
    register,
  }
}
