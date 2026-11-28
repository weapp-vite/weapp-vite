import type { WebRuntimeNativeInject } from '../../../../runtime/config/internal/injectRequestGlobals/nativeInject'
import { rolldown } from 'rolldown'
import { parseAst } from 'rolldown/parseAst'
import { describe, expect, it } from 'vitest'
import {
  createNativeDeleteTargets,
  isNativeDeleteGuardModuleId,
  protectNativeInjectedGlobalDeletes,
} from './nativeDelete'

const inject = {
  'fetch': ['virtual:bindings', 'fetch'],
  'globalThis.fetch': ['virtual:bindings', 'fetch'],
  'URL': ['virtual:bindings', 'URL'],
  'self.URL': ['virtual:bindings', 'URL'],
} satisfies Record<string, [string, string]>

const plan = { inject } as WebRuntimeNativeInject
const parserLike = { parse: parseAst }

function protect(code: string, id = '/project/src/entry.ts') {
  return protectNativeInjectedGlobalDeletes(code, id, createNativeDeleteTargets(plan), parserLike)
}

async function emit(source: string, options: { cjs?: boolean, guarded?: boolean } = {}) {
  const id = options.cjs ? 'virtual:entry.cjs' : 'virtual:entry.js'
  const bundle = await rolldown({
    input: id,
    transform: { inject },
    plugins: [
      {
        name: 'probe-virtual',
        resolveId(request) {
          return request.startsWith('virtual:') ? request : null
        },
        load(request) {
          if (request === id) {
            return source
          }
          if (request === 'virtual:bindings') {
            return `export const fetch = () => 'fetch'; export const URL = class URL {}`
          }
          return null
        },
      },
      ...(options.guarded
        ? [{
            name: 'probe-guard',
            transform(code: string, moduleId: string) {
              return protectNativeInjectedGlobalDeletes(
                code,
                moduleId,
                createNativeDeleteTargets(plan),
                parserLike,
              )
            },
          }]
        : []),
    ],
  })
  try {
    const result = await bundle.generate({ format: 'esm' })
    return result.output
      .filter(output => output.type === 'chunk')
      .map(output => output.code)
      .join('\n')
  }
  finally {
    await bundle.close()
  }
}

describe('native injected global delete guard', () => {
  it.each([
    '/project/src/entry.js',
    '/project/src/entry.ts',
    '/project/src/entry.tsx',
    '/project/node_modules/dependency/index.cjs',
  ])('recognizes script module %s', (id) => {
    expect(isNativeDeleteGuardModuleId(id)).toBe(true)
  })

  it.each([
    '/project/src/entry.vue',
    '/project/src/entry.css',
    'virtual:weapp-vite-web-runtime:bindings',
  ])('ignores non-script module %s', (id) => {
    expect(isNativeDeleteGuardModuleId(id)).toBe(false)
  })

  it('rewrites only injected dotted delete targets to equivalent computed access', () => {
    const result = protect(`
      export const first = delete globalThis.fetch
      export const second = delete (self).URL
      export const third = delete global.URL
      export const unrelated = delete globalThis.Headers
      export const read = globalThis.fetch
    `)

    expect(result?.code).toContain('delete globalThis["fetch"]')
    expect(result?.code).toContain('delete self["URL"]')
    expect(result?.code).toContain('delete global.URL')
    expect(result?.code).toContain('delete globalThis.Headers')
    expect(result?.code).toContain('globalThis.fetch')
    expect(result?.code).not.toContain('delete (self).URL')
  })

  it('keeps local shadowing semantics while avoiding injected delete bindings', () => {
    const result = protect('function read(globalThis) { return delete globalThis.fetch }')
    expect(result?.code).toBe('function read(globalThis) { return delete globalThis["fetch"] }')
  })

  it('does not parse modules without delete or configured dotted targets', () => {
    expect(protect('export const value = globalThis.fetch')).toBeNull()
    expect(protectNativeInjectedGlobalDeletes(
      'export const value = delete globalThis.Headers',
      '/project/src/entry.ts',
      new Map(),
      { parse: () => { throw new Error('must not parse') } },
    )).toBeNull()
  })

  it('emits valid ESM instead of deleting an injected binding', async () => {
    const source = 'export const removed = (() => { delete globalThis.fetch; return typeof globalThis.fetch })()'
    const unguarded = await emit(source)
    const guarded = await emit(source, { guarded: true })

    expect(unguarded).toContain('delete fetch')
    expect(guarded).toContain('delete globalThis["fetch"]')
    expect(guarded).not.toContain('delete fetch')
  })

  it('protects CommonJS dependencies without losing native injection coverage', async () => {
    const source = 'module.exports = (() => { const value = globalThis.fetch(); delete globalThis.fetch; return value })()'
    const guarded = await emit(source, { cjs: true, guarded: true })

    expect(guarded).toContain('delete globalThis["fetch"]')
    expect(guarded).not.toContain('delete fetch')
    expect(guarded).toMatch(/fetch\(\)/u)
  })
})
