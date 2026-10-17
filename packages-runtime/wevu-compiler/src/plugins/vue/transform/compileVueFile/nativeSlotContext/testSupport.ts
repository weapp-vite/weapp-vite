import type { CompileVueFileOptions } from '../types'
import type { NativeSlotContextAnalysisCache } from './index'
import path from 'pathe'
import { parse } from 'vue/compiler-sfc'
import { collectComponentSourceInfo } from '../componentSources'
import { analyzeNativeSlotContext } from './index'

export function createAnalysisFixture(initial: Record<string, string> = {}) {
  const files = new Map(Object.entries(initial))
  const reads: string[] = []
  const resolutions: Array<[string, string | undefined]> = []
  const cache: NativeSlotContextAnalysisCache = new Map()
  const options: CompileVueFileOptions = {
    warn: () => {},
    componentMetaCache: new Map(),
    nativeSlotContextCache: cache,
    sfcSrc: {
      async resolveId(source, importer) {
        resolutions.push([source, importer])
        if (!source.startsWith('.') && !path.isAbsolute(source)) {
          return undefined
        }
        const id = path.resolve(path.dirname(importer ?? '/project/Root.vue'), source)
        return [id, `${id}.ts`, `${id}.js`, `${id}/index.ts`].find(candidate => files.has(candidate))
      },
      async readFile(id) {
        reads.push(id)
        const source = files.get(id)
        if (source === undefined) {
          throw new Error(`Missing fixture ${id}`)
        }
        return source
      },
    },
    autoUsingComponents: {
      enabled: true,
      warn: () => {},
      async resolveUsingComponentPath(source, importer) {
        const id = await options.sfcSrc!.resolveId!(source, importer)
        return id ? { from: id, resolvedId: id, sourceType: id.endsWith('.vue') ? 'wevu-sfc' : 'native' } : undefined
      },
    },
  }
  const analyze = async (source: string, filename = '/project/Root.vue') => {
    const descriptor = parse(source, { filename }).descriptor
    const components = await collectComponentSourceInfo({
      descriptor,
      descriptorForCompile: descriptor,
      filename,
      compileOptions: options,
      autoUsingComponents: options.autoUsingComponents,
      autoImportTags: options.autoImportTags,
    })
    return analyzeNativeSlotContext({ descriptor, filename, components, options })
  }
  return { files, reads, resolutions, cache, options, analyze }
}
