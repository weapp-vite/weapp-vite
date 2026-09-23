import type { Plugin } from 'vite'
import path from 'pathe'
import { invalidateFileCache } from '../../packages-runtime/wevu-compiler/src/plugins/utils/cache'
import { compileVueFile } from '../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile'
import { createStatefulHmrInitialGraph } from '../../packages/weapp-vite/src/runtime/statefulHmr/initialModuleGraph'

/** 复用 compiler/native integration fixture 的真实编译入口，不模拟 compiler 或 DevEngine。 */
export function createSequenceFixturePlugin(root: string, stateful: boolean, readSource: (filename: string) => Promise<string>): Plugin {
  return {
    name: 'edit-sequence-compiler-fixture',
    watchChange(id) {
      invalidateFileCache(id)
    },
    async transform(source, id) {
      if (!id.endsWith('.vue')) {
        return
      }
      const compiled = await compileVueFile(source, id, {
        isPage: true,
        sourceMap: false,
        skipComponentTransform: true,
        sfcSrc: {
          readFile: (filename) => {
            this.addWatchFile(filename)
            return readSource(filename)
          },
        },
      })
      for (const dependency of compiled.meta?.sfcSrcDeps ?? []) {
        this.addWatchFile(dependency)
      }
      const basename = path.relative(root, id).replace(/\.vue$/, '')
      for (const [extension, content] of [['wxml', compiled.template], ['wxss', compiled.style], ['json', compiled.config]] as const) {
        if (content !== undefined) {
          this.emitFile({ type: 'asset', fileName: `${basename}.${extension}`, source: content })
        }
      }
      if (compiled.script === undefined) {
        throw new Error(`SFC compilation did not emit a script: ${id}`)
      }
      return { code: compiled.script, map: null, meta: { editSequenceWatchFiles: compiled.meta?.sfcSrcDeps } }
    },
    renderChunk(code, chunk) {
      if (stateful) {
        return { code: `${code}${createStatefulHmrInitialGraph(chunk, this, root)}`, map: null }
      }
    },
  }
}
