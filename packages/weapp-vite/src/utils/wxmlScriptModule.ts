import type { MpPlatform } from '../types'
import { getMiniProgramPlatformAdapter } from '../platform'

const IMPORT_SJS_TAG_RE = /<import-sjs([\s\S]*?)>/g
const IMPORT_SJS_SRC_RE = /\bsrc\s*=\s*/g
const IMPORT_SJS_MODULE_RE = /\bmodule\s*=\s*/g

export function resolveScriptModuleTagByPlatform(platform?: MpPlatform, scriptModuleExtension?: string) {
  if (!platform || !scriptModuleExtension) {
    return undefined
  }
  return getMiniProgramPlatformAdapter(platform).scriptModuleTagByExtension?.[scriptModuleExtension]
}

export function normalizeImportSjsAttributes(source: string) {
  return source
    .replace(IMPORT_SJS_TAG_RE, (tag) => {
      return tag
        .replace(IMPORT_SJS_SRC_RE, 'from=')
        .replace(IMPORT_SJS_MODULE_RE, 'name=')
    })
}
