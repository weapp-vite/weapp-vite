import type { OutputChunk } from 'rolldown'
import type { NativeNpmChunkAnalysis, NativeNpmLocalRootFact, NativeNpmPlatformApiFact } from '../../../../../ast'
import MagicString from 'magic-string'
import { applyMagicStringChunkRewrite } from '../../../../../utils/outputChunk'

export interface NpmChunkTextEdit {
  start: number
  end: number
  replacement: string
}

/** 校验全部互不重叠的范围后再应用，避免错误摘要留下部分 MagicString 编辑。 */
export function createNativeChunkMagicString(code: string, edits: NpmChunkTextEdit[]) {
  const sorted = [...edits].sort((left, right) => left.start - right.start)
  if (sorted.some((edit, index) => !Number.isSafeInteger(edit.start) || !Number.isSafeInteger(edit.end)
    || edit.start < 0 || edit.end <= edit.start || edit.end > code.length
    || (index > 0 && edit.start < sorted[index - 1]!.end))) {
    throw new RangeError('Invalid native npm chunk edit range')
  }
  const magicString = new MagicString(code)
  for (const edit of edits) {
    magicString.update(edit.start, edit.end, edit.replacement)
  }
  return magicString
}

/** 先完成代码与映射组合，再提交 chunk；native 消费异常不会留下部分修改。 */
export function applyNativeChunkRewrite(chunk: OutputChunk, magicString: MagicString) {
  const staged = { ...chunk }
  applyMagicStringChunkRewrite(staged, magicString)
  chunk.code = staged.code
  chunk.map = staged.map
}

/** 字面量替换与 interop 删除后，只投影仍待消费的 API 范围；不复用已消费的 npm 事实。 */
export function projectNpmChunkAnalysis(
  analysis: NativeNpmChunkAnalysis,
  edits: NpmChunkTextEdit[],
): NativeNpmChunkAnalysis | undefined {
  const sorted = [...edits].sort((left, right) => left.start - right.start)
  if (sorted.some((edit, index) => index > 0 && edit.start < sorted[index - 1]!.end)) {
    return undefined
  }
  const ranges: NativeNpmPlatformApiFact[] = []
  for (const range of analysis.platformApiRanges) {
    let delta = 0
    for (const edit of sorted) {
      if (edit.end <= range.start) {
        delta += edit.replacement.length - (edit.end - edit.start)
      }
      else if (edit.start < range.end) {
        return undefined
      }
    }
    ranges.push({ start: range.start + delta, end: range.end + delta })
  }
  return { requires: [], localRootFacts: [], platformApiRanges: ranges }
}

function isRelativeMiniprogramNpmImport(importee: string) {
  return importee === 'miniprogram_npm'
    || importee.startsWith('./miniprogram_npm/')
    || importee.startsWith('../miniprogram_npm/')
    || importee.includes('/miniprogram_npm/')
}

function isLocalized(fact: NativeNpmLocalRootFact, bindings: Set<string>) {
  return Boolean(fact.referenceName && bindings.has(fact.referenceName))
    || Boolean(fact.importee && isRelativeMiniprogramNpmImport(fact.importee))
}

function findPreviousCommaIndex(code: string, start: number) {
  for (let index = start - 1; index >= 0; index--) {
    if (code[index] === ',') {
      return index
    }
    if (!/\s/.test(code[index]!)) {
      return start
    }
  }
  return start
}

/** 顺序消费 native 的进入节点事实，保留原 Babel localizedRequireBindings 的生命周期语义。 */
export function createNativeLocalRootNpmEdits(
  code: string,
  analysis: NativeNpmChunkAnalysis,
  resolve: (importee: string) => string,
) {
  const bindings = new Set<string>()
  const edits: NpmChunkTextEdit[] = []
  for (const fact of analysis.localRootFacts) {
    if (fact.kind === 'alias') {
      if (fact.bindingName && isLocalized(fact, bindings)) {
        bindings.add(fact.bindingName)
      }
      continue
    }
    if (fact.kind === 'require') {
      const requireFact = analysis.requires[fact.requireIndex!]
      if (!requireFact) {
        return undefined
      }
      const next = resolve(requireFact.importee)
      if (next === requireFact.importee) {
        continue
      }
      edits.push({ start: requireFact.start, end: requireFact.end, replacement: JSON.stringify(next) })
      if (fact.bindingName && isRelativeMiniprogramNpmImport(next)) {
        bindings.add(fact.bindingName)
      }
      continue
    }
    if (isLocalized(fact, bindings)) {
      edits.push({
        start: findPreviousCommaIndex(code, fact.secondArgumentStart!),
        end: fact.secondArgumentEnd!,
        replacement: '',
      })
    }
  }
  const sorted = [...edits].sort((left, right) => left.start - right.start)
  if (sorted.some((edit, index) => edit.start < 0 || edit.end <= edit.start || edit.end > code.length
    || (index > 0 && edit.start < sorted[index - 1]!.end))) {
    return undefined
  }
  return edits
}
