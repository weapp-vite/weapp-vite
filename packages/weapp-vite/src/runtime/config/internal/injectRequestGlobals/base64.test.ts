import vm from 'node:vm'
import { REQUEST_GLOBAL_PLACEHOLDER_KEY } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { atobPolyfill, btoaPolyfill } from '../../../../../../../packages-runtime/web-apis/src/base64'
import { createRequestGlobalsPassiveBindingsCode } from '../injectRequestGlobals'
import { REQUEST_GLOBAL_BASE64_HELPER } from './base64'

type CallResult
  = | { ok: true, value: string }
    | { ok: false, error: string }

function call(fn: (input: any) => string, input: unknown): CallResult {
  try {
    return { ok: true, value: fn(input) }
  }
  catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    }
  }
}

function createSandbox() {
  const context = vm.createContext({}) as Record<string, any>
  const vmContext = context as unknown as vm.Context
  vm.runInContext(createRequestGlobalsPassiveBindingsCode(['atob', 'btoa']), vmContext)
  return {
    atob: context.atob as (input: unknown) => string,
    btoa: context.btoa as (input: unknown) => string,
    context,
    vmContext,
  }
}

const inputs: unknown[] = [
  '',
  'A',
  'AB',
  'ABC',
  'ABCD',
  'Hello, world!',
  'QQ==',
  'QUI=',
  ' Q\tQ\n= = ',
  'a'.repeat(256),
  '\u0000\u00FF\u0080',
  'null',
  'undefined',
  0,
  1,
  12_345,
  null,
  undefined,
  true,
  {},
  ['A'],
  '@@@@',
  'Q',
  'QQ',
  'QQQ',
  '====',
  'QQ==x',
  'é',
  '中文',
]

describe('inline web runtime base64 polyfill', () => {
  it('matches @wevu/web-apis atobPolyfill / btoaPolyfill for valid and invalid inputs', () => {
    const sandbox = createSandbox()

    for (const input of inputs) {
      expect(call(sandbox.atob, input), `atob(${String(input)})`).toEqual(call(atobPolyfill, input))
      expect(call(sandbox.btoa, input), `btoa(${String(input)})`).toEqual(call(btoaPolyfill, input))
    }
  })

  it('is usable during module initialization without an installer', () => {
    const sandbox = createSandbox()

    expect(sandbox.atob('QQ==')).toBe('A')
    expect(sandbox.btoa('AB')).toBe('QUI=')
    expect(vm.runInContext(`typeof ${REQUEST_GLOBAL_BASE64_HELPER}`, sandbox.vmContext)).toBe('object')
  })

  it('does not mark the real polyfill as a placeholder', () => {
    const sandbox = createSandbox()

    expect(sandbox.context.atob?.[REQUEST_GLOBAL_PLACEHOLDER_KEY]).not.toBe(true)
    expect(sandbox.context.btoa?.[REQUEST_GLOBAL_PLACEHOLDER_KEY]).not.toBe(true)
  })
})
