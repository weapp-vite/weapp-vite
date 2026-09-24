import type { SFCParseResult } from '@vue/language-core'
import type { SequenceInput } from './driver'
import type { AnalysisSnapshot } from './editor'
import path from 'pathe'
import { invalidateFileCache } from '../../packages-runtime/wevu-compiler/src/plugins/utils/cache'
import { readAndParseSfc } from '../../packages-runtime/wevu-compiler/src/plugins/utils/vueSfc'
import { compileVueFile } from '../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile'
import { observeBlocks, observeError } from './editor'

export async function observeCompiler(input: SequenceInput, root: string): Promise<AnalysisSnapshot> {
  const result: AnalysisSnapshot = { files: {} }
  const files = input.files
  // 正常 watch 路径也在文件事件时失效读取缓存；不清空 parse/编译缓存。
  const changed = input.action?.kind === 'rapid' ? input.action.saves : input.action ? [input.action] : []
  for (const action of changed) {
    invalidateFileCache(path.join(root, action.file))
    if (action.kind === 'rename') {
      invalidateFileCache(path.join(root, action.to))
    }
  }
  const sfcSrc = {
    resolveId: async (source: string, importer = root) => path.resolve(path.dirname(importer), source),
    readFile: async (filename: string) => {
      const relative = path.relative(root, filename)
      if (!Object.hasOwn(files, relative)) {
        throw new Error(`Missing dependency: ${relative}`)
      }
      return files[relative]!
    },
  }
  const config = files['sequence.config.json'] ? JSON.parse(files['sequence.config.json']) as { isPage?: boolean } : {}
  for (const [file, source] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    if (!file.endsWith('.vue')) {
      continue
    }
    const filename = path.join(root, file)
    try {
      const parsed = await readAndParseSfc(filename, { source, resolveSrc: sfcSrc })
      const compiled = await compileVueFile(source, filename, {
        isPage: config.isPage ?? true,
        sourceMap: false,
        sfcSrc,
        bindingManifestSourceFile: file,
      })
      result.files[file] = {
        blocks: observeBlocks(parsed.descriptor as SFCParseResult['descriptor']),
        diagnostics: [...parsed.errors.map(observeError), ...(compiled.diagnostics ?? [])],
        bindings: compiled.bindingManifest,
        runtimeCapabilities: compiled.meta?.runtimeCapabilities,
        dependencies: compiled.meta?.sfcSrcDeps,
        script: compiled.script,
        template: compiled.template,
        style: compiled.style,
        config: compiled.config,
      }
    }
    catch (error) {
      result.files[file] = { error: observeError(error) }
    }
  }
  return result
}
