import type { SFCParseResult } from '@vue/language-core'
import type { SFCBlock } from 'vue/compiler-sfc'
import * as compilerDom from '@vue/compiler-dom'
import { parseSfc, updateSfc } from '../../packages/volar/src/parseSfc'

export interface AnalysisSnapshot {
  files: Record<string, unknown>
}

/** 保留完整 block 坐标与内容；AST、map 和函数不是编辑器 block 契约。 */
export function observeBlocks(descriptor: SFCParseResult['descriptor']) {
  const block = (value: SFCParseResult['descriptor']['template'] | SFCBlock | null) => value === null
    ? null
    : {
        type: value.type,
        content: value.content,
        attrs: value.attrs,
        lang: value.lang,
        loc: value.loc,
        src: 'src' in value ? value.src : undefined,
        sourceAttribute: '__src' in value ? value.__src : undefined,
        scoped: 'scoped' in value ? value.scoped : undefined,
        module: 'module' in value ? value.module : undefined,
        moduleAttribute: '__module' in value ? value.__module : undefined,
        setup: 'setup' in value ? value.setup : undefined,
        generic: '__generic' in value ? value.__generic : undefined,
      }
  return {
    source: descriptor.source,
    template: block(descriptor.template),
    script: block(descriptor.script),
    scriptSetup: block(descriptor.scriptSetup),
    styles: descriptor.styles.map(block),
    customBlocks: descriptor.customBlocks.map(block),
    cssVars: descriptor.cssVars,
    slotted: descriptor.slotted,
  }
}

export function observeError(error: unknown): unknown {
  if (typeof error === 'string') {
    return { message: error }
  }
  if (!(error instanceof Error)) {
    return error
  }
  return {
    name: error.name,
    message: error.message,
    code: 'code' in error ? error.code : undefined,
    loc: 'loc' in error ? error.loc : undefined,
    filename: 'filename' in error ? error.filename : undefined,
    id: 'id' in error ? error.id : undefined,
    plugin: 'plugin' in error ? error.plugin : undefined,
    pluginCode: 'pluginCode' in error ? error.pluginCode : undefined,
    pos: 'pos' in error ? error.pos : undefined,
    frame: 'frame' in error ? error.frame : undefined,
  }
}

export class EditorSequenceSession {
  private readonly parsed = new Map<string, SFCParseResult>()

  observe(files: Readonly<Record<string, string>>): AnalysisSnapshot {
    for (const filename of this.parsed.keys()) {
      if (!Object.hasOwn(files, filename)) {
        this.parsed.delete(filename)
      }
    }
    const result: AnalysisSnapshot = { files: {} }
    for (const [filename, source] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
      if (!filename.endsWith('.vue')) {
        continue
      }
      const previous = this.parsed.get(filename)
      let parsed: SFCParseResult | undefined
      if (previous) {
        const before = previous.descriptor.source
        let start = 0
        while (start < before.length && start < source.length && before[start] === source[start]) {
          start++
        }
        let oldEnd = before.length
        let newEnd = source.length
        while (oldEnd > start && newEnd > start && before[oldEnd - 1] === source[newEnd - 1]) {
          oldEnd--
          newEnd--
        }
        parsed = source === before ? previous : updateSfc(previous, { start, end: oldEnd, newText: source.slice(start, newEnd) })
      }
      parsed ??= parseSfc(compilerDom, source, filename)
      this.parsed.set(filename, parsed)
      // 克隆防止下一次 updateSfc 原位改写已经保存的观察结果。
      result.files[filename] = structuredClone({ blocks: observeBlocks(parsed.descriptor), diagnostics: parsed.errors.map(observeError) })
    }
    return result
  }
}
