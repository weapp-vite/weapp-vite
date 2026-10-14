import type { CompilerGenerateResult } from 'weapp-tailwindcss/core'

type SourceEntry = CompilerGenerateResult['sources'][number]
type Shape = 'directory' | 'extension' | 'file'

const MAX_COMPACTED_PATTERN_LENGTH = 8192

function isLiteral(value: string): boolean {
  return /^[\w.-]+$/.test(value) && value !== '.' && !value.includes('..')
}

function classify(entry: SourceEntry): { shape: Shape, token: string } | undefined {
  if (entry.negated !== true || typeof entry.base !== 'string' || typeof entry.pattern !== 'string' || !entry.pattern.startsWith('**/')) {
    return undefined
  }
  const rest = entry.pattern.slice(3)
  if (rest.endsWith('/**')) {
    const token = rest.slice(0, -3)
    return isLiteral(token) ? { shape: 'directory', token } : undefined
  }
  const extension = /^\*\.([\w-]+)$/.exec(rest)?.[1]
  if (extension) {
    return { shape: 'extension', token: extension }
  }
  return isLiteral(rest) ? { shape: 'file', token: rest } : undefined
}

function combinedPattern(shape: Shape, tokens: ReadonlySet<string>): string {
  const prefix = shape === 'extension' ? '**/*.' : '**/'
  const suffix = shape === 'directory' ? '/**' : ''
  return `${prefix}{${[...tokens].join(',')}}${suffix}`
}

/** 仅合并连续的固定否定形态；保留上游 globstar、隐藏文件与异常求值顺序。 */
export function compactTailwindSourceEntries(entries: readonly SourceEntry[]): SourceEntry[] {
  const result: SourceEntry[] = []
  for (let index = 0; index < entries.length;) {
    const first = entries[index]!
    const shape = classify(first)
    if (!shape) {
      result.push(first)
      index += 1
      continue
    }
    const run = [first]
    const tokens = new Set([shape.token])
    let next = index + 1
    while (next < entries.length) {
      const current = entries[next]!
      const member = classify(current)
      if (current.base !== first.base || member?.shape !== shape.shape) {
        break
      }
      run.push(current)
      tokens.add(member.token)
      next += 1
    }
    const pattern = combinedPattern(shape.shape, tokens)
    result.push(...tokens.size > 1 && pattern.length <= MAX_COMPACTED_PATTERN_LENGTH
      ? [{ ...first, pattern }]
      : run)
    index = next
  }
  return result
}
