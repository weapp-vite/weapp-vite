import { expect, it } from 'vitest'
import { evaluateStrict } from './helpers.mjs'
import { extractSubpathImportsMethod } from './resolver.mjs'

it('extracts the original inline resolver callback without a patch-specific factory', () => {
  const source = `
function oxcResolvePlugin() {
  return nativePlugin({
    resolveSubpathImports(id, importer, isRequire) {
      return resolveSubpathImports(id, importer, {
        ...options,
        isRequire: resolveOptions.isRequire ?? isRequire
      });
    },
    ...partialEnv.config.command === "serve" ? { onWarn() {} } : {}
  });
}
function optimizerResolvePlugin() {}
`
  const calls: unknown[][] = []
  const method = extractSubpathImportsMethod(source)
  const context = evaluateStrict(`globalThis.create = (options, resolveOptions) => ({ ${method} }).resolveSubpathImports;`, {
    resolveSubpathImports: (...args: unknown[]) => {
      calls.push(args)
      return args[0]
    },
  })
  const options = { conditions: ['custom'], isProduction: false }
  const overrides: { isRequire?: boolean } = {}
  const callback = context.create(options, overrides)
  expect(callback('#mode', 'entry.js', true)).toBe('#mode')
  expect(calls.at(-1)).toEqual(['#mode', 'entry.js', { ...options, isRequire: true }])
  options.isProduction = true
  overrides.isRequire = false
  callback('#mode', 'entry.js', true)
  expect(calls.at(-1)).toEqual(['#mode', 'entry.js', { ...options, isRequire: false }])
})
