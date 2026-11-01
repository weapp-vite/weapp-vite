import type { OutputBundle, OutputChunk } from 'rolldown'
import vm from 'node:vm'
import { REQUEST_GLOBAL_BUNDLE_MARKER, REQUEST_GLOBAL_INSTALLER_MARKER, REQUEST_GLOBAL_PRELUDE_MARKER } from '@weapp-core/constants'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseJsLike } from '../../../../../utils/babel'
import { createRequestGlobalsPreludeCode, injectRequestGlobalsBundleRuntime } from '../requestGlobals'

vi.mock('../../../../../utils/babel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../utils/babel')>()
  return { ...actual, parseJsLike: vi.fn(actual.parseJsLike) }
})

const installerCode = [
  'function installRuntime() { return { URL: class { constructor() { this.value = "ready"; } } }; }',
  `Object.defineProperty(installRuntime, ${JSON.stringify(REQUEST_GLOBAL_INSTALLER_MARKER)}, { value: true });`,
  // 使用既有公共 getter 语法，使 export fallback 的额外解析与 installer 发现次数可区分。
  'Object.defineProperty(exports,"installWebRuntimeGlobals",{enumerable:true,get:function(){return installRuntime}});',
].join('\n')

function chunk(fileName: string, code: string): OutputChunk {
  return { type: 'chunk', fileName, code, imports: [], dynamicImports: [] } as unknown as OutputChunk
}

function publish(output: OutputChunk) {
  const bundle: OutputBundle = { [output.fileName]: output }
  return injectRequestGlobalsBundleRuntime(bundle, ['URL'], 'explicit')
}

describe('request globals installer discovery work', () => {
  beforeEach(() => {
    vi.mocked(parseJsLike).mockClear()
  })

  it('discovers each current chunk once while preserving ownership and executable injection', () => {
    const runtime = chunk('runtime.js', installerCode)
    const page = chunk('pages/index.js', 'exports.page = "ready";')
    const support = chunk('support.js', 'exports.label = "installWebRuntimeGlobals";')
    const inputs = [runtime, page, support].map(output => output.code)
    const bundle: OutputBundle = {
      [runtime.fileName]: runtime,
      [page.fileName]: page,
      [support.fileName]: support,
    }

    expect(injectRequestGlobalsBundleRuntime(bundle, ['URL'], 'explicit'))
      .toEqual(new Map([['runtime.js', 'installWebRuntimeGlobals']]))
    for (const [index, input] of inputs.entries()) {
      expect(vi.mocked(parseJsLike).mock.calls.filter(([code]) => code === input)).toHaveLength(index === 1 ? 0 : 1)
    }
    expect(page.code).toBe(inputs[1])
    expect(support.code).toBe(inputs[2])
    expect(runtime.code).toContain(REQUEST_GLOBAL_BUNDLE_MARKER)
    expect(vm.runInNewContext(`${runtime.code}\nnew URL().value`, { exports: {} })).toBe('ready')
  })

  it('discovers replacements on the same chunk without retaining a negative or retired installer', () => {
    const output = chunk('runtime.js', 'exports.phase = "empty";')
    const versions = [
      { code: output.code, expected: new Map<string, string>(), parses: 0 },
      { code: installerCode, expected: new Map([['runtime.js', 'installWebRuntimeGlobals']]), parses: 1 },
      {
        code: `/* ${REQUEST_GLOBAL_BUNDLE_MARKER} */ exports.phase = "retired";`,
        expected: new Map<string, string>(),
        parses: 0,
      },
      {
        code: `/* ${REQUEST_GLOBAL_BUNDLE_MARKER} */ exports.phase = "installWebRuntimeGlobals";`,
        expected: new Map<string, string>(),
        parses: 1,
      },
    ]

    for (const version of versions) {
      output.code = version.code
      expect(publish(output)).toEqual(version.expected)
      expect(vi.mocked(parseJsLike).mock.calls.filter(([code]) => code === version.code))
        .toHaveLength(version.parses)
      if (version.expected.size) {
        expect(vm.runInNewContext(`${output.code}\nnew URL().value`, { exports: {} })).toBe('ready')
      }
      else {
        expect(output.code).toBe(version.code)
      }
    }
  })

  it('reuses inline installer discovery while keeping the prelude executable and the input unchanged', () => {
    const output = chunk('inline.js', installerCode)
    const prelude = createRequestGlobalsPreludeCode(output, new Map(), ['URL'], 'explicit')

    expect(vi.mocked(parseJsLike).mock.calls.filter(([code]) => code === installerCode)).toHaveLength(1)
    expect(prelude).toContain(REQUEST_GLOBAL_PRELUDE_MARKER)
    expect(output.code).toBe(installerCode)
    expect(vm.runInNewContext(`${output.code}\n${prelude}\nnew URL().value`, { exports: {} })).toBe('ready')
  })

  it('keeps a missing inline installer result while resolving an installer from a current require', () => {
    const output = chunk('consumer.js', 'const runtime = require("./runtime.js"); exports.phase = "consumer";')
    const code = output.code
    const prelude = createRequestGlobalsPreludeCode(
      output,
      new Map([['runtime.js', 'installWebRuntimeGlobals']]),
      ['URL'],
      'explicit',
    )

    expect(vi.mocked(parseJsLike).mock.calls.filter(([source]) => source === code)).toHaveLength(0)
    expect(prelude).toContain(REQUEST_GLOBAL_PRELUDE_MARKER)
    expect(output.code).toBe(code)
  })
})
