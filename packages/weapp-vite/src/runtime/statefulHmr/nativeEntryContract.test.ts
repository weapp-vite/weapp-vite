import type { StatefulHmrOutputFile } from './outputWriter'
import { createContext, runInContext } from 'node:vm'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_RUNTIME_CONTRACT_METHOD } from '@weapp-core/constants'
import MagicString from 'magic-string'
import { describe, expect, it } from 'vitest'
import { readMappedHmrCode } from './mappedCode'
import { protectStatefulHmrNativeEntries } from './nativeEntryContract'
import { transformStatefulHmrOutput } from './outputTransform'

function entry(code: string): Extract<StatefulHmrOutputFile, { type: 'chunk' }> {
  return { type: 'chunk', fileName: 'app.js', code, modules: {}, isEntry: true }
}

describe('final native CJS entry protection', () => {
  it('maps native entry statements through target conversion and the final capability guard', async () => {
    const code = 'const marker = "mapped-native-entry";\nglobalThis.entryMarker = marker;'
    const output = await transformStatefulHmrOutput([{
      ...entry(code),
      map: new MagicString(code).generateMap({ source: 'page.ts', includeContent: true, hires: true }),
    }], true)
    protectStatefulHmrNativeEntries(output)
    const chunk = output[0]
    if (chunk?.type !== 'chunk') {
      throw new Error('Expected a protected native entry')
    }
    const mapped = readMappedHmrCode(chunk.code, chunk.fileName)
    const lines = mapped.code.split('\n')
    const line = lines.findIndex(line => line.includes('globalThis.entryMarker'))
    expect(originalPositionFor(new TraceMap(mapped.map as any), {
      line: line + 1,
      column: lines[line]!.indexOf('globalThis.entryMarker'),
    })).toMatchObject({ source: 'page.ts', line: 2, column: 0 })
    expect(chunk.code.match(/sourceMappingURL=/g)).toHaveLength(1)
  })

  it('is idempotent and preserves strict execution, CommonJS exports and lexical this/arguments on first bootstrap', () => {
    const chunk = entry('"use strict"; exports.thisValue = this; exports.argumentValue = arguments[2]; exports.strictThis = (function () { return this; })();')
    protectStatefulHmrNativeEntries([chunk])
    const protectedCode = chunk.code
    protectStatefulHmrNativeEntries([chunk])
    expect(chunk.code).toBe(protectedCode)
    const exports: Record<string, unknown> = {}
    const execute = runInContext(`(function(require,module,exports){${chunk.code}\n})`, createContext({}))
    execute.call(exports, () => {}, { exports }, exports)
    expect(exports.thisValue).toBe(exports)
    expect(exports.argumentValue).toBe(exports)
    expect(exports.strictThis).toBeUndefined()
  })

  it('preserves a first-bootstrap dependency failure when no client is installed', () => {
    const chunk = entry('require("./runtime.js"); exports.unreachable = true;')
    protectStatefulHmrNativeEntries([chunk])
    const exports: Record<string, unknown> = {}
    const failure = new Error('initial runtime dependency failed')
    const execute = runInContext(`(function(require,module,exports){${chunk.code}\n})`, createContext({}))
    let thrown: unknown
    try {
      execute(() => {
        throw failure
      }, { exports }, exports)
    }
    catch (error) {
      thrown = error
    }
    expect(thrown).toBe(failure)
    expect(exports.unreachable).toBeUndefined()
  })

  it('retains a missing client method error rather than silently skipping the module', () => {
    const chunk = entry('exports.unreachable = true;')
    protectStatefulHmrNativeEntries([chunk])
    const context = createContext({ [WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY]: {} })
    const execute = runInContext(`(function(require,module,exports){${chunk.code}\n})`, context)
    expect(() => execute(() => {}, { exports: {} }, {})).toThrow(WEAPP_VITE_STATEFUL_HMR_RUNTIME_CONTRACT_METHOD)
  })

  it('keeps shared chunks and non-script assets outside the native entry lifecycle', () => {
    const shared = { ...entry('exports.shared = true;'), isEntry: false }
    const asset = { type: 'asset' as const, fileName: 'page.json', source: '{"component":true}' }
    const originalCode = shared.code
    protectStatefulHmrNativeEntries([shared, asset])
    expect(shared.code).toBe(originalCode)
    expect(asset.source).toBe('{"component":true}')
  })
})
