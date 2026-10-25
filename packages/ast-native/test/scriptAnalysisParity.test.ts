import { fileURLToPath } from 'node:url'
import {
  analyzeScript,
  analyzeScripts,
  mayContainPlatformApiAccess,
  mayContainStaticRequireLiteral,
} from '@weapp-vite/ast'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  analyzeScriptNative,
  analyzeScriptsNative,
  mayContainPlatformApiAccessNative,
  mayContainStaticRequireLiteralNative,
} from '../index.js'

const staticRequireSources = [
  String.raw`require('\uD800')`,
  String.raw`require('\uDC00')`,
  'require(`\\uD800`)',
  'require(`\\uDC00`)',
  String.raw`require('\uD83D\uDE00')`,
  'require(`\\uD83D\\uDE00`)',
  'require(\'中文-😀\')',
  'require(`中文-😀`)',
  'require(\'\')',
  'require(``)',
]
// 注释保留原文本预筛选边界，AST 中只包含待验证的 computed 访问。
const computedPlatformSources = [
  String.raw`/* wx. */ wx['\uD800']()`,
  String.raw`/* wx. */ wx['\uDC00']()`,
  '/* wx. */ wx[`\\uD800`]()',
  '/* wx. */ wx[`\\uDC00`]()',
  String.raw`/* wx. */ wx['\uD83D\uDE00']()`,
  '/* wx. */ wx[`中文-😀`]()',
  '/* wx. */ wx[\'\']()',
  '/* wx. */ wx[``]()',
]
const unchangedSources = [
  'require(name)',
  // eslint-disable-next-line no-template-curly-in-string -- 保留待解析源码中的动态模板插值。
  'require(`pkg/${name}`)',
  'require(42)',
  'require(tag`pkg`)',
  String.raw`wx['\uD800']()`,
]
const sharedCases = [
  ...staticRequireSources.map(code => ({ code, staticRequire: true, platformApi: false })),
  ...computedPlatformSources.map(code => ({ code, staticRequire: false, platformApi: true })),
  ...unchangedSources.map(code => ({ code, staticRequire: false, platformApi: false })),
]
const neighborCode = 'const neighbor = 1'
const emptyNativeFacts = { featureFlags: [], hasPlatformApiAccess: false, hasStaticRequireLiteral: false }

beforeEach(() => {
  vi.stubEnv('WEAPP_VITE_NATIVE_AST_PATH', fileURLToPath(new URL('../index.js', import.meta.url)))
})
afterEach(() => vi.unstubAllEnvs())

describe('actual addon script analysis boolean parity', () => {
  it.each(sharedCases)('preserves JS facts and neighboring batch items for $code', ({ code, staticRequire, platformApi }) => {
    const nativeFacts = { featureFlags: [], hasPlatformApiAccess: platformApi, hasStaticRequireLiteral: staticRequire }
    const publicFacts = { ...nativeFacts, featureFlags: new Set() }
    const inputs = [{ code }, { code: neighborCode }]
    vi.stubEnv('WEAPP_VITE_NATIVE', '0')
    const baseline = analyzeScript(code, { engine: 'oxc' })
    const baselineBatch = analyzeScripts(inputs, { engine: 'oxc' })
    expect(baseline).toEqual(publicFacts)

    expect(mayContainStaticRequireLiteralNative(code)).toBe(staticRequire)
    expect(mayContainPlatformApiAccessNative(code)).toBe(platformApi)
    expect(analyzeScriptNative(code)).toEqual(nativeFacts)
    expect(analyzeScriptsNative(inputs)).toEqual([nativeFacts, emptyNativeFacts])

    vi.stubEnv('WEAPP_VITE_NATIVE', '1')
    expect(mayContainStaticRequireLiteral(code, { engine: 'oxc' })).toBe(staticRequire)
    expect(mayContainPlatformApiAccess(code, { engine: 'oxc' })).toBe(platformApi)
    expect(analyzeScript(code, { engine: 'oxc' })).toEqual(baseline)
    expect(analyzeScripts(inputs, { engine: 'oxc' })).toEqual(baselineBatch)
  })

  it.each([
    '/* wx. */ wx[name]()',
    // eslint-disable-next-line no-template-curly-in-string -- 保留待解析源码中的动态模板插值。
    '/* wx. */ wx[`prefix${name}`]()',
  ])('preserves the existing native dynamic computed boundary for %s', (code) => {
    expect(mayContainPlatformApiAccessNative(code)).toBe(false)
    expect(analyzeScriptNative(code)).toEqual(emptyNativeFacts)
    expect(analyzeScriptsNative([{ code }, { code: neighborCode }])).toEqual([emptyNativeFacts, emptyNativeFacts])
  })
})
