import type { WeappCompilerHmrPreparation } from '../../types/compilerPlugin'
import type { EncodedSourceMapLike } from '../../utils/sourcemap'
import type { StatefulHmrPatchImports } from './patchModule'
import type { StatefulHmrDevEngineUpdate } from './viteAdapter'
import { Buffer } from 'node:buffer'
import remapping from '@jridgewell/remapping'
import MagicString, { Bundle } from 'magic-string'
import { transformWithOxc } from 'vite'
import { composeSourceMaps, normalizeEncodedSourceMapLike } from '../../utils/sourcemap'
import { transformStatefulHmrPatchImports } from './patchModule'

export interface PreparedHmrCode {
  code: string
  filename: string
  map?: EncodedSourceMapLike | null
}

export function wrapHmrCode(part: PreparedHmrCode, prefix = '', suffix = ''): string {
  const source = new MagicString(part.code).prepend(prefix).append(suffix)
  const code = source.toString()
  if (!part.map) {
    return code
  }
  const map = composeSourceMaps(source.generateMap({ source: part.filename, includeContent: true, hires: true }), part.map)
  return `${code}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${Buffer.from(JSON.stringify(map)).toString('base64')}`
}

/** 转换每一层都组合旧映射，避免最终更新模块携带原始 Patch 的失效 map。 */
export async function prepareHmrPatch(
  patch: Extract<StatefulHmrDevEngineUpdate, { type: 'Patch' }>,
  preparations: WeappCompilerHmrPreparation[],
  imports: StatefulHmrPatchImports,
  sourcemap: boolean,
): Promise<PreparedHmrCode> {
  let code = patch.code.replace(/^\/\/[#@] sourceMappingURL=.*$/gm, '')
  let map = sourcemap && patch.sourcemap ? normalizeEncodedSourceMapLike(JSON.parse(patch.sourcemap)) : null
  // 部分原生 Patch 只提供来源清单而没有映射；此时保留到原始 Patch 的映射，不能组合出空结果。
  if (map && (!map.sources.length || !map.mappings)) {
    map = null
  }
  for (const preparation of preparations) {
    const result = await preparation.transformJavaScript?.({ code, fileName: patch.filename })
    if (result) {
      if (sourcemap && result.code !== code && !result.map) {
        throw new Error('Compiler HMR transform changed code without a source map')
      }
      map = composeSourceMaps(normalizeEncodedSourceMapLike(result.map), map)
      code = result.code
    }
  }
  code = transformStatefulHmrPatchImports(code, {
    ...imports,
    onMap: (value) => {
      map = composeSourceMaps(value, map)
    },
  })
  const result = await transformWithOxc(code, patch.filename, {
    assumptions: { setPublicClassFields: true },
    lang: 'js',
    sourcemap,
    target: 'es2018',
    tsconfig: false,
  })

  return {
    code: result.code,
    filename: patch.filename,
    map: sourcemap ? composeSourceMaps(normalizeEncodedSourceMapLike(result.map), map) : null,
  }
}

/** 合并补丁同时映射闭包和传输包装；只在最终文件末尾输出一个 inline map。 */
export function bundleHmrCode(parts: PreparedHmrCode[], prefix = '', suffix = ''): string {
  const bundle = new Bundle({ separator: '\n', intro: prefix })
  const maps = new Map<string, EncodedSourceMapLike>()
  for (const part of parts) {
    const source = new MagicString(part.code, { filename: part.filename })
    source.prepend('(() => {\n').append('\n})();')
    bundle.addSource(source)
    if (part.map) {
      maps.set(part.filename, part.map)
    }
  }
  bundle.append(suffix)
  const code = bundle.toString()
  if (!maps.size) {
    return code
  }
  const generated = bundle.generateMap({ hires: true, includeContent: true })
  const map = remapping(generated as any, (source, context) => context.depth === 1 ? maps.get(source) as any ?? null : null)
  return `${code}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${Buffer.from(JSON.stringify(map)).toString('base64')}`
}

export function readMappedHmrCode(code: string, filename: string): PreparedHmrCode {
  const match = /\n\/\/# sourceMappingURL=data:application\/json;charset=utf-8;base64,(\S+)\s*$/.exec(code)
  if (!match) {
    return { code, filename }
  }
  return {
    code: code.slice(0, match.index),
    filename,
    map: normalizeEncodedSourceMapLike(JSON.parse(Buffer.from(match[1]!, 'base64').toString('utf8'))),
  }
}
