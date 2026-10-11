import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  requests: [] as string[],
  failure: undefined as { specifier: string, error: Error } | undefined,
}))

vi.mock('node:module', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:module')>()
  return {
    ...actual,
    createRequire(filename: string | URL) {
      const nodeRequire = actual.createRequire(filename)
      return Object.assign((specifier: string) => {
        if (specifier === '@babel/preset-env' || specifier === '@babel/preset-typescript') {
          state.requests.push(specifier)
          if (state.failure?.specifier === specifier) {
            const { error } = state.failure
            state.failure = undefined
            throw error
          }
        }
        return nodeRequire(specifier)
      }, nodeRequire)
    },
  }
})

vi.mock('@babel/preset-env', () => {
  throw new Error('WXS must not statically import preset-env')
})
vi.mock('@babel/preset-typescript', () => {
  throw new Error('WXS must not statically import preset-typescript')
})

beforeEach(() => {
  vi.resetModules()
  state.requests = []
  state.failure = undefined
})

describe('WXS preset loading', () => {
  it('does not load presets when importing the WXS entry', async () => {
    const { transformWxsCode } = await import('./index')
    expect(typeof transformWxsCode).toBe('function')
    expect(state.requests).toEqual([])
  })

  it.each(['wxs', 'sjs'])('loads real ESM presets on the first synchronous %s conversion', async (extension) => {
    const { transformWxsCode } = await import('./index')
    const { result, importees } = transformWxsCode(`
      import helper from './helper.ts'
      const total: number = 2
      export default { total, helper }
    `, { filename: 'script.ts', extension })

    expect(result?.code).toContain('var total = 2')
    expect(result?.code).not.toContain(': number')
    expect(importees).toContainEqual({ source: './helper.ts' })
    if (extension === 'sjs') {
      expect(result?.code).toContain('export default')
      expect(result?.code).not.toContain('module.exports')
    }
    else {
      expect(result?.code).toContain('module.exports.default')
      expect(result?.code).not.toContain('export default')
    }
    expect(state.requests).toEqual(['@babel/preset-env', '@babel/preset-typescript'])

    transformWxsCode('const next: number = 3', { filename: 'next.ts', extension })
    expect(state.requests).toEqual(['@babel/preset-env', '@babel/preset-typescript'])
  })

  it.each(['@babel/preset-env', '@babel/preset-typescript'])('preserves a %s loading error and retries the next conversion', async (specifier) => {
    const { transformWxsCode } = await import('./index')
    const error = new Error('preset load failed')
    state.failure = { specifier, error }

    let caught: unknown
    try {
      transformWxsCode('const total: number = 2')
    }
    catch (failure) {
      caught = failure
    }
    expect(caught).toBe(error)
    expect(state.failure).toBeUndefined()
    const failedRequests = [...state.requests]
    expect(transformWxsCode('const total: number = 2').result?.code).toContain('var total = 2')
    expect(state.requests).toEqual([...failedRequests, '@babel/preset-env', '@babel/preset-typescript'])
  })
})
