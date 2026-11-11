import vm from 'node:vm'
import { REQUEST_GLOBAL_ACTUALS_KEY, REQUEST_GLOBAL_PLACEHOLDER_KEY } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { AbortControllerPolyfill } from '../../../../../../../packages-runtime/web-apis/src/abort'
import { RequestPolyfill } from '../../../../../../../packages-runtime/web-apis/src/http/request'
import { createRequestGlobalsPassiveBindingsCode, FULL_REQUEST_GLOBAL_TARGETS } from '../injectRequestGlobals'
import { EARLY_CAPABILITY_REQUEST_GLOBAL_TARGETS } from './earlyCapabilities'

const KY_PROBE = `(() => {
  let duplexAccessed = false
  let hasContentType = false
  let streamError = null
  try {
    const request = new globalThis.Request('https://empty.invalid', {
      body: new globalThis.ReadableStream(),
      method: 'POST',
      get duplex() { duplexAccessed = true; return 'half' },
    })
    hasContentType = request.headers.has('Content-Type')
  }
  catch (error) { streamError = String(error) }
  let abortError = null
  let abortSignalAborted = null
  try {
    const controller = new globalThis.AbortController()
    controller.abort()
    abortSignalAborted = controller.signal.aborted
  }
  catch (error) { abortError = String(error) }
  return {
    supportsRequestStreams: (duplexAccessed || ('Bun' in globalThis) || ('Deno' in globalThis)) && !hasContentType,
    supportsAbortController: typeof globalThis.AbortController === 'function',
    supportsAbortSignal: typeof globalThis.AbortSignal === 'function' && typeof globalThis.AbortSignal.any === 'function',
    supportsResponseStreams: typeof globalThis.ReadableStream === 'function',
    supportsFormData: typeof globalThis.FormData === 'function',
    streamError,
    abortError,
    abortSignalAborted,
  }
})()`

function createSandbox() {
  const context = vm.createContext({}) as Record<string, any>
  const vmContext = context as unknown as vm.Context
  vm.runInContext(createRequestGlobalsPassiveBindingsCode(FULL_REQUEST_GLOBAL_TARGETS), vmContext)
  return {
    context,
    vmContext,
    run: (code: string) => vm.runInContext(code, vmContext),
  }
}

describe('early constructable web runtime capabilities', () => {
  it('lets ky-style module-initialization probes finish without an installer', () => {
    const result = createSandbox().run(KY_PROBE)

    expect(result.streamError).toBeNull()
    expect(result.abortError).toBeNull()
    expect(result.abortSignalAborted).toBe(true)
    expect(result.supportsAbortController).toBe(true)
    expect(result.supportsResponseStreams).toBe(true)
    expect(result.supportsFormData).toBe(true)
    // AbortSignalPolyfill 没有静态 any，RequestPolyfill 不读取 duplex，两个 false 与真实实现一致。
    expect(result.supportsAbortSignal).toBe(false)
    expect(result.supportsRequestStreams).toBe(false)
  })

  it('keeps the Request fallback aligned with RequestPolyfill duplex handling', () => {
    let realDuplexAccessed = false
    const realRequest = new RequestPolyfill('https://empty.invalid', {
      method: 'POST',
      get duplex() {
        realDuplexAccessed = true
        return 'half'
      },
    })
    expect(realRequest.method).toBe('POST')
    expect(realDuplexAccessed).toBe(false)

    const fallbackDuplexAccessed = createSandbox().run(`(() => {
      let accessed = false
      new globalThis.Request('https://empty.invalid', {
        method: 'POST',
        get duplex() { accessed = true; return 'half' },
      })
      return accessed
    })()`)
    expect(fallbackDuplexAccessed).toBe(false)
  })

  it('marks early placeholders so installWebRuntimeGlobals replaces them on globalThis', () => {
    const sandbox = createSandbox()

    for (const name of EARLY_CAPABILITY_REQUEST_GLOBAL_TARGETS) {
      expect(sandbox.context[name]?.[REQUEST_GLOBAL_PLACEHOLDER_KEY], name).toBe(true)
    }
  })

  it('forwards to the real implementations once the installer writes actuals', () => {
    const sandbox = createSandbox()
    const actuals = sandbox.context[REQUEST_GLOBAL_ACTUALS_KEY] as Record<string, any>
    const requestCtor = RequestPolyfill as any
    const abortCtor = AbortControllerPolyfill as any
    requestCtor.__earlyCapabilityMarker = true
    abortCtor.__earlyCapabilityMarker = true
    actuals.Request = RequestPolyfill
    actuals.AbortController = AbortControllerPolyfill
    sandbox.context.Request = RequestPolyfill
    sandbox.context.AbortController = AbortControllerPolyfill

    expect(sandbox.run(`typeof new Request('https://empty.invalid').clone`)).toBe('function')
    expect(sandbox.run(`new Request('https://empty.invalid').constructor.__earlyCapabilityMarker`)).toBe(true)
    expect(sandbox.run(`new AbortController().constructor.__earlyCapabilityMarker`)).toBe(true)
    expect(sandbox.run(`(() => { const controller = new AbortController(); controller.abort(); return controller.signal.aborted })()`)).toBe(true)
  })
})
