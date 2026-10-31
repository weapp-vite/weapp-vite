import type { MpPlatform } from '@weapp-core/shared'
import { transformFilterCode } from './filter'
import { transformWxsCode } from './index'

/** 原生脚本保持宿主语法与模块原文，只有显式编译源码进入 Babel 转换。 */
export async function prepareWxsSource(source: string, options: { filename: string, extension?: string, platform?: MpPlatform, compile?: boolean, filter?: boolean }) {
  const extension = (options.extension ?? 'wxs').replace(/^\./, '').toLowerCase()
  const native = !options.compile && options.filename.toLowerCase().endsWith(`.${extension}`)
  if (native) {
    const { analyzeScript } = await import('@weapp-vite/language-service')
    const analysis = analyzeScript(source, options.filename, { platform: options.platform, sourceKind: 'native' })
    const syntax = analysis.diagnostics.find(diagnostic => diagnostic.code === 'script/syntax')
    if (syntax) {
      throw new SyntaxError(`${options.filename}: ${syntax.message}`)
    }
    return { code: source, importees: analysis.references.map(reference => ({ source: reference.source })), native }
  }
  if (options.filter) {
    return { ...transformFilterCode(source, options.compile ? `${options.filename}.ts` : options.filename), native }
  }
  const { result, importees } = transformWxsCode(source, { ...options, filename: options.compile ? `${options.filename}.ts` : options.filename })
  return { code: result?.code, importees, native }
}
