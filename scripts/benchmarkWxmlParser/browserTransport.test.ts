import type { PluginBuild, ResolveResult } from 'esbuild'
import { describe, expect, it } from 'vitest'
import { createRequire } from './browserBabelModule'
import { browserConsumerTransport, browserTransportPlan } from './browserTransport'

describe('scanner browser module transport', () => {
  it('uses the actual Babel parser and rejects every unknown module', () => {
    const require = createRequire()
    const parser = require('@babel/parser')
    expect(parser.parse('const value: string = "</wxs>"', { plugins: ['typescript'] }).program.body[0]!.type).toBe('VariableDeclaration')
    expect(() => parser.parse('const =')).toThrow()
    expect(() => require('node:fs')).toThrow('Unsupported')
    expect(() => require('@babel/traverse')).toThrow('Unsupported')
  })

  it('limits Node loading and the AST export alias to the scanner closure', () => {
    const callbacks = new Map<string, (args: { importer: string }) => ResolveResult | undefined>()
    const plan = browserTransportPlan('candidate-scanner.mjs')
    browserConsumerTransport(plan).setup({ onResolve(options, callback) {
      callbacks.set(options.filter.source, callback as never)
    } } as PluginBuild)
    const module = callbacks.get('^node:module$')!
    expect(module({ importer: plan.babel })).toEqual({ path: plan.bridge })
    expect(module({ importer: plan.baselineScanner })).toEqual({ path: plan.bridge })
    expect(() => module({ importer: plan.astEntry })).toThrow('outside')
    const ast = callbacks.get('^@weapp-vite\\/ast$')!
    expect(ast({ importer: `${plan.languageService}/chunk.mjs` })).toEqual({ path: plan.babel })
    expect(ast({ importer: `${plan.languageService}-other/chunk.mjs` })).toBeUndefined()
    const compiler = callbacks.get('^wevu\\/compiler$')!
    expect(compiler({ importer: plan.candidateScanner! })).toEqual({ path: plan.compilerBuiltin })
    expect(compiler({ importer: plan.baselineScanner })).toBeUndefined()
  })
})
