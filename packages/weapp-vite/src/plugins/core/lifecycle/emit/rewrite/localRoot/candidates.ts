import { isProxy } from 'node:util/types'

const REQUIRE_IDENTIFIER_RE = /\brequire\b/
const DEPENDENCY_TOKEN_RE = /^(?:@[\w.-]+|\w[\w.-]*)$/
const ARRAY_INDEX_RE = /^(?:0|[1-9]\d*)$/

/** 只接受普通数据数组，避免候选枚举与原 matcher 读取不同的规则或触发额外 getter。 */
function hasStaticPatternArray(patterns: (string | RegExp)[] | undefined) {
  if (patterns === undefined) {
    return true
  }
  if (isProxy(patterns) || !Array.isArray(patterns) || Object.getPrototypeOf(patterns) !== Array.prototype) {
    return false
  }
  const descriptors = Object.getOwnPropertyDescriptors(patterns)
  return Reflect.ownKeys(descriptors).every(key => key === 'length' || (
    typeof key === 'string' && ARRAY_INDEX_RE.test(key) && 'value' in descriptors[key]!
  ))
}

function collectDependencyTokens(
  dependencyPatterns: (string | RegExp)[] | undefined,
  dependencies: Record<string, string> | undefined,
) {
  const patterns = Array.isArray(dependencyPatterns) && dependencyPatterns.length > 0
    ? dependencyPatterns
    : Object.keys(dependencies ?? {}).map(dependency => dependency.replaceAll('\\', '/'))
  const tokens = new Set<string>()
  for (const pattern of patterns) {
    if (typeof pattern !== 'string') {
      return
    }
    // fallback 前缀匹配会忽略空路径段，作用域包只取首段，避免重复斜线造成漏判。
    const token = pattern.split('/').find(Boolean)
    if (!token || !DEPENDENCY_TOKEN_RE.test(token)) {
      return
    }
    tokens.add(token)
  }
  return [...tokens]
}

/** 只证明无需 npm 重写；转义、未知作用域和正则规则保留原 AST 路径。 */
export function createLocalRootNpmCandidateCheck(
  dependencyPatterns: (string | RegExp)[] | undefined,
  dependencies: Record<string, string> | undefined,
) {
  let tokens: string[] | undefined
  let hasLiteralScope = false
  try {
    hasLiteralScope = !isProxy(dependencies) && hasStaticPatternArray(dependencyPatterns)
    tokens = collectDependencyTokens(dependencyPatterns, dependencies)
  }
  catch {
    // 依赖对象无法静态枚举时，仍由原重写流程处理。
  }
  return {
    mayNeedRewrite(code: string) {
      // 标识符只能用 Unicode 转义；普通正则反斜线不会生成 require 标识符。
      if (!REQUIRE_IDENTIFIER_RE.test(code) && !code.includes('\\u')) {
        return false
      }
      if (code.includes('\\') || code.includes('miniprogram_npm') || !tokens) {
        return true
      }
      return tokens.some(token => code.includes(token))
    },
    mayNeedLiteralRewrite(importee: string) {
      // 解析后的字面量已解码转义；普通路径只比较首段，不调用 matcher 或文件系统解析。
      return !hasLiteralScope || !tokens
        || importee.includes('\\')
        || importee.includes('node_modules')
        || importee.startsWith('npm:')
        || tokens.includes(importee.split('/').find(Boolean) ?? '')
    },
  }
}
