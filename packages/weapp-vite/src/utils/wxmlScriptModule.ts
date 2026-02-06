import type { MpPlatform } from '../types'

export function resolveScriptModuleTagByPlatform(platform?: MpPlatform, scriptModuleExtension?: string) {
  if (platform === 'alipay' && scriptModuleExtension === 'sjs') {
    return 'import-sjs'
  }
  return undefined
}

export function normalizeImportSjsAttributes(source: string) {
  return source
    .replace(/<import-sjs([\s\S]*?)>/g, (tag) => {
      return tag
        .replace(/\bsrc\s*=\s*/g, 'from=')
        .replace(/\bmodule\s*=\s*/g, 'name=')
    })
}
