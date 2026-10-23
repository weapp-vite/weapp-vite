import type { WeappCompilerHmrPreparation } from '../../types/compilerPlugin'
import type { EncodedSourceMapLike } from '../../utils/sourcemap'
import type { PreparedHmrCode } from './mappedCode'
import type { StatefulHmrPatchImports } from './patchModule'
import type { StatefulHmrDevEngineUpdate } from './viteAdapter'
import { Buffer } from 'node:buffer'
import remapping from '@jridgewell/remapping'
import { transformHmrPatch } from '@weapp-vite/hmr'
import MagicString, { Bundle } from 'magic-string'
import { transformWithOxc } from 'vite'
import { composeSourceMaps, normalizeEncodedSourceMapLike } from '../../utils/sourcemap'
import { transformStatefulHmrPatchImports } from './patchModule'

export type { PreparedHmrCode } from './mappedCode'
export { readMappedHmrCode, wrapHmrCode } from './mappedCode'

/** 转换每一层都组合旧映射，避免最终更新模块携带原始 Patch 的失效 map。 */
export async function prepareHmrPatch(
  patch: Extract<StatefulHmrDevEngineUpdate, { type: 'Patch' }>,
  preparations: WeappCompilerHmrPreparation[],
  imports: StatefulHmrPatchImports,
  sourcemap: boolean,
): Promise<PreparedHmrCode> {
  const transformed = await transformHmrPatch(patch, preparations, sourcemap)
  let { code, map } = transformed
  code = transformStatefulHmrPatchImports(code, {
    ...imports,
    onMap: sourcemap
      ? (value) => {
          map = composeSourceMaps(value, map)
        }
      : undefined,
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
