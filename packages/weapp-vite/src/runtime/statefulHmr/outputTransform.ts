import type { StatefulHmrOutputFile } from './outputWriter'
import { transformWithOxc } from 'vite'
import { composeSourceMaps, normalizeEncodedSourceMapLike } from '../../utils/sourcemap'
import { wrapHmrCode } from './mappedCode'

export async function transformStatefulHmrOutput(output: StatefulHmrOutputFile[], sourcemap: boolean): Promise<StatefulHmrOutputFile[]> {
  const mapFiles = new Set(output.flatMap(item => item.type === 'chunk' ? [item.sourcemapFileName ?? `${item.fileName}.map`] : []))
  return await Promise.all(output.filter(item => !mapFiles.has(item.fileName)).map(async (item) => {
    if (item.type !== 'chunk') {
      return item
    }
    const code = item.code.replace(/^\/\/[#@] sourceMappingURL=.*$/gm, '')
    const result = await transformWithOxc(code, item.fileName, {
      assumptions: { setPublicClassFields: true },
      lang: 'js',
      sourcemap,
      target: 'es2018',
      tsconfig: false,
    })
    return {
      ...item,
      code: wrapHmrCode({
        code: result.code,
        filename: item.fileName,
        map: sourcemap ? composeSourceMaps(normalizeEncodedSourceMapLike(result.map), normalizeEncodedSourceMapLike(item.map)) : null,
      }),
    }
  }))
}
