interface CompiledGlob {
  prefix: string
  suffix: string
  segments: string[]
  minimumLength: number
}

export interface NameMatcher {
  exact: Set<string>
  patterns: CompiledGlob[]
}

export function compileNames(names: string | string[]): NameMatcher {
  const exact = new Set<string>()
  const patterns: CompiledGlob[] = []
  for (const name of typeof names === 'string' ? [names] : names) {
    const firstStar = name.indexOf('*')
    if (firstStar < 0) {
      exact.add(name)
      continue
    }
    const lastStar = name.lastIndexOf('*')
    const prefix = name.slice(0, firstStar)
    const suffix = name.slice(lastStar + 1)
    const segments: string[] = []
    let minimumLength = prefix.length + suffix.length
    for (let start = firstStar + 1; start < lastStar;) {
      const end = name.indexOf('*', start)
      // 相邻星号之间没有字面量，编译时直接合并，不留下重复匹配步骤。
      if (end > start) {
        segments.push(name.slice(start, end))
        minimumLength += end - start
      }
      start = end + 1
    }
    patterns.push({ prefix, suffix, segments, minimumLength })
  }
  return { exact, patterns }
}

function matchesGlob(pattern: CompiledGlob, name: string): boolean {
  if (name.length < pattern.minimumLength || !name.startsWith(pattern.prefix) || !name.endsWith(pattern.suffix)) {
    return false
  }
  let position = pattern.prefix.length
  const end = name.length - pattern.suffix.length
  // 始终选取最早的下一段，不回退；固定后缀不能被中间字面量重复消费。
  for (const segment of pattern.segments) {
    const next = name.indexOf(segment, position)
    if (next < 0 || next + segment.length > end) {
      return false
    }
    position = next + segment.length
  }
  return true
}

export function matches(matcher: NameMatcher, name: string): boolean {
  if (matcher.exact.has(name)) {
    return true
  }
  for (const pattern of matcher.patterns) {
    if (matchesGlob(pattern, name)) {
      return true
    }
  }
  return false
}
