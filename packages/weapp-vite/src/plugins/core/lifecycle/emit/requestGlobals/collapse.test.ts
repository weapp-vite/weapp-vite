import type { OutputBundle, OutputChunk } from 'rolldown'
import vm from 'node:vm'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { collapseRequestGlobalsRuntimeSupportChunk } from '../requestGlobals'

const runtime = 'weapp-vendors/request-globals-runtime.js'
const support = 'weapp-vendors/request-globals-web-apis-shared.js'

function chunk(fileName: string, code: string): OutputChunk {
  return { type: 'chunk', fileName, code, imports: [], dynamicImports: [] } as unknown as OutputChunk
}

function execute(bundle: OutputBundle, entry: string) {
  const cache = new Map<string, { exports: Record<string, any> }>()
  function load(file: string): Record<string, any> {
    const cached = cache.get(file)
    if (cached) {
      return cached.exports
    }
    const module = { exports: {} }
    cache.set(file, module)
    const output = bundle[file] as OutputChunk
    if (!output) {
      throw new Error(`Missing module ${file}`)
    }
    vm.runInNewContext(output.code, {
      module,
      exports: module.exports,
      require: (request: string) => load(path.posix.normalize(path.posix.join(path.posix.dirname(file), request))),
    }, { filename: file })
    return module.exports
  }
  return load(entry)
}

function fixture(transitive: boolean): OutputBundle {
  const feature = 'weapp-vendors/feature.js'
  return {
    [support]: chunk(support, 'exports.RequestGlobalsEventTarget = class { value() { return "ready" } };'),
    [feature]: chunk(feature, 'const base = require("./request-globals-web-apis-shared.js"); exports.Signal = class extends base.RequestGlobalsEventTarget {};'),
    ...(transitive
      ? {
          'weapp-vendors/bridge.js': chunk('weapp-vendors/bridge.js', 'module.exports = require("./feature.js");'),
        }
      : {}),
    [runtime]: chunk(runtime, `const base = require("./request-globals-web-apis-shared.js"); const feature = require("./${transitive ? 'bridge' : 'feature'}.js"); exports.create = () => new feature.Signal();`),
  }
}

describe('request globals support chunk ownership', () => {
  it.each([false, true])('does not introduce a CommonJS cycle through a transitive=%s runtime dependency', (transitive) => {
    const bundle = fixture(transitive)
    expect(execute(bundle, runtime).create().value()).toBe('ready')

    collapseRequestGlobalsRuntimeSupportChunk(bundle)

    expect(execute(bundle, runtime).create().value()).toBe('ready')
    expect(bundle[support]).toBeDefined()
  })

  it('still collapses support used only by the runtime and its external consumers', () => {
    const bundle: OutputBundle = {
      [support]: chunk(support, 'exports.marker = "ready";'),
      [runtime]: chunk(runtime, 'const base = require("./request-globals-web-apis-shared.js"); exports.marker = base.marker;'),
      'app.js': chunk('app.js', 'const base = require("./weapp-vendors/request-globals-web-apis-shared.js"); module.exports = base;'),
    }
    collapseRequestGlobalsRuntimeSupportChunk(bundle)
    expect(bundle[support]).toBeUndefined()
    expect(execute(bundle, 'app.js').marker).toBe('ready')
  })
})
