export interface ExternalMetadataFileCandidates {
  packageName: string
  /**
   * Relative paths from package root.
   */
  dts: string[]
  /**
   * Relative paths from package root.
   */
  js: string[]
}

function resolveVantExternalMetadataCandidates(from: string): ExternalMetadataFileCandidates | undefined {
  if (!from.startsWith('@vant/weapp/')) {
    return undefined
  }
  const component = from.slice('@vant/weapp/'.length)
  if (!component) {
    return undefined
  }
  return {
    packageName: '@vant/weapp',
    dts: [
      `lib/${component}/index.d.ts`,
      `dist/${component}/index.d.ts`,
    ],
    js: [
      `lib/${component}/index.js`,
      `dist/${component}/index.js`,
    ],
  }
}

function resolveTDesignExternalMetadataCandidates(from: string): ExternalMetadataFileCandidates | undefined {
  if (!from.startsWith('tdesign-miniprogram/')) {
    return undefined
  }

  const relative = from.slice('tdesign-miniprogram/'.length)
  const segments = relative.split('/').filter(Boolean)
  const componentDir = segments[0]
  const fileBase = segments.at(-1)
  if (!componentDir || !fileBase) {
    return undefined
  }

  const base = `miniprogram_dist/${componentDir}/${fileBase}`
  return {
    packageName: 'tdesign-miniprogram',
    dts: [`${base}.d.ts`],
    js: [`${base}.js`],
  }
}

export function resolveExternalMetadataCandidates(from: string): ExternalMetadataFileCandidates | undefined {
  return resolveTDesignExternalMetadataCandidates(from)
    ?? resolveVantExternalMetadataCandidates(from)
}
