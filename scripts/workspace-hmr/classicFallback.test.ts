import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { parse } from '@babel/parser'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY, WEAPP_VITE_STATEFUL_HMR_DIRECTORY } from '@weapp-core/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmittedScriptReader } from '../benchmarkTemplatesHmr/emittedOutput'
import { WorkspaceHmrClassicFallback } from './classicFallback'
import { inspectClassicEmittedScript } from './classicRuntimeInspection'

const clock = vi.hoisted(() => ({ now: 0 }))
vi.mock('node:timers/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:timers/promises')>()
  return {
    ...actual,
    async setTimeout(delay = 1, value?: unknown, options?: { signal?: AbortSignal }) {
      options?.signal?.throwIfAborted()
      clock.now += delay
      return value
    },
  }
})

const requested = '[weapp-vite] HMR fallback {"from":"stateful-experimental","to":"classic","reason":"native-registration"}'
const ready = '[weapp-vite] HMR classic ready {"reason":"native-registration"}'

describe('classic bridge registration aliases', () => {
  it.each([
    'const bridge = globalThis?.[key]; const { installNative: install } = bridge; install("Page", Page);',
    'const bridge = globalThis?.[key]; const method = "takeNativeDefinitions"; const { [method]: take } = bridge; take();',
    'const bridge = globalThis?.[key]; let install; ({ installNative: install } = bridge); install("Page", Page);',
    'let alias; alias = globalThis?.[key]; const next = alias; next.installNative("Page", Page);',
    'const bridge = globalThis?.[key]; let alias; alias = bridge; const next = alias; next.takeNativeDefinitions();',
    'const bridge = globalThis?.[key]; let first, second; first = bridge; second = first; first = second; second.installNative("Page", Page);',
  ])('rejects a retained installer through destructuring or assigned aliases: %s', (source) => {
    const ast = parse(`const key = "__WEAPP_VITE_STATEFUL_HMR_BRIDGE__"; ${source}`)
    expect(() => inspectClassicEmittedScript(ast)).toThrow('active stateful bridge')
  })

  it('keeps assigned optional Component probes and ignores unrelated shadowed bindings', () => {
    const ast = parse(`
      const key = "__WEAPP_VITE_STATEFUL_HMR_BRIDGE__";
      const bridge = globalThis?.[key];
      let alias;
      alias = bridge;
      if (typeof alias?.Component === "function") alias.Component({});
      else Component({});
      function unrelated(alias) { alias.installNative("Page", Page); }
    `)
    expect(() => inspectClassicEmittedScript(ast)).not.toThrow()
  })
})

describe('workspace HMR classic fallback evidence', () => {
  let root: string
  let output: string
  let fallback: WorkspaceHmrClassicFallback

  beforeEach(async () => {
    clock.now = 0
    // 只由轮询推进逻辑时间，真实文件系统耗时不改变本例要验证的失败阶段。
    vi.spyOn(Date, 'now').mockImplementation(() => clock.now)
    root = await mkdtemp(path.join(os.tmpdir(), 'hmr-classic-audit-'))
    output = ''
    fallback = new WorkspaceHmrClassicFallback(root, () => output)
    await mkdir(path.join(root, 'pages'), { recursive: true })
    await writeFile(path.join(root, 'app.js'), 'App({});')
    await writeFile(path.join(root, 'app.json'), JSON.stringify({ pages: ['pages/index'] }))
    await writeFile(path.join(root, 'pages/index.js'), 'require("./render.js");')
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(root, { recursive: true, force: true })
  })

  it('requires matching readiness even when the old control and patch are absent', async () => {
    expect(fallback.requested).toBe(false)
    await expect(fallback.settle({ deadline: Date.now() + 30 })).rejects.toThrow('no matching ready transition')
    output = requested
    expect(fallback.requested).toBe(true)
    await expect(fallback.settle({ deadline: Date.now() + 30 })).rejects.toThrow('no matching ready transition')
    expect(fallback.actualMode).toBeUndefined()
  })

  it('rejects a readiness reason from another transition', async () => {
    output = `${requested}\n[weapp-vite] HMR classic ready {"reason":"entry-topology"}`
    await expect(fallback.settle({ deadline: Date.now() + 100 })).rejects.toThrow('does not match')
  })

  it.each(['', `\n${ready}`])('rejects a repeated transition even if its earlier readiness matches: %s', async (completion) => {
    output = `${requested}\n${ready}\n${requested}${completion}`
    await expect(fallback.settle({ deadline: Date.now() + 30 })).rejects.toThrow('transitioned more than once')
    expect(fallback.actualMode).toBeUndefined()
  })

  it('rejects readiness that becomes observable only after its original deadline', async () => {
    let now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    fallback = new WorkspaceHmrClassicFallback(root, () => {
      now = 100
      return `${requested}\n${ready}`
    })
    await expect(fallback.settle({ deadline: 50 })).rejects.toThrow('after the mutation deadline')
    expect(fallback.actualMode).toBeUndefined()
  })

  it.each(['control.js', 'update.js', 'preload.js'])('rejects ready while the retired %s remains', async (file) => {
    output = `${requested}\n${ready}`
    await mkdir(path.join(root, '__weapp_vite_hmr'))
    await writeFile(path.join(root, '__weapp_vite_hmr', file), 'void 0;')
    await expect(fallback.settle({ deadline: Date.now() + 100 })).rejects.toThrow('retained stateful artifact')
  })

  it('validates the current reachable graph for later saves and restoration without a stateful client', async () => {
    output = `${requested}\n${ready}`
    const readOutput = createEmittedScriptReader(path.join(root, 'pages/index.js'), root)
    const options = { readOutput, output: 'pages/index.js', deadline: Date.now() + 100 }
    await writeFile(path.join(root, 'pages/render.js'), 'console.log("first-change");')
    await expect(fallback.waitForDelivery({ ...options, marker: 'first-change', contains: true })).resolves.toMatchObject({ delivery: 'classic', actualMode: 'classic', reason: 'native-registration' })
    await writeFile(path.join(root, 'pages/render.js'), 'console.log("next-change");')
    await expect(fallback.waitForDelivery({ ...options, marker: 'next-change', contains: true })).resolves.toMatchObject({ delivery: 'classic' })
    await writeFile(path.join(root, 'pages/render.js'), 'console.log("baseline");')
    await writeFile(path.join(root, 'orphan.js'), 'console.log("next-change");')
    await expect(fallback.waitForDelivery({ ...options, marker: 'next-change', contains: false })).resolves.toMatchObject({ delivery: 'classic', containsMarker: false })
    expect(fallback.actualMode).toBe('classic')
  })

  it('does not accept a missing script graph as successful restoration', async () => {
    output = `${requested}\n${ready}`
    await expect(fallback.waitForDelivery({
      readOutput: createEmittedScriptReader(path.join(root, 'pages/index.js'), root),
      output: 'pages/index.js',
      marker: 'changed',
      contains: false,
      deadline: Date.now() + 30,
    })).rejects.toThrow('does not match the current source mutation')
  })

  it.each([
    ['page stamp', 'pages/index.js', '// weapp-vite-stateful-build:old\nrequire("./render.js");'],
    ['shared stamp', 'pages/render.js', '// weapp-vite-stateful-build:old\nconsole.log("changed");'],
    ['page bridge', 'pages/index.js', 'globalThis.__WEAPP_VITE_STATEFUL_HMR_BRIDGE__; require("./render.js");'],
    ['shared client', 'pages/render.js', 'globalThis.__WEAPP_VITE_STATEFUL_HMR_CLIENT__; console.log("changed");'],
    ['aliased bridge access', 'pages/render.js', 'const host = globalThis; const originalKey = "__WEAPP_VITE_STATEFUL_HMR_BRIDGE__"; const alias = originalKey; host[alias].installNative("Page", Page); console.log("changed");'],
    ['aliased bridge install', 'pages/render.js', 'const host = globalThis; const key = "__WEAPP_VITE_STATEFUL_HMR_BRIDGE__"; host[key] = {}; console.log("changed");'],
    ['optional bridge registration', 'pages/render.js', 'const key = "__WEAPP_VITE_STATEFUL_HMR_BRIDGE__"; const bridge = globalThis?.[key]; const alias = bridge; alias.installNative("Page", Page); console.log("changed");'],
    ['destructured bridge registration', 'pages/render.js', 'const key = "__WEAPP_VITE_STATEFUL_HMR_BRIDGE__"; const { [key]: bridge } = globalThis; bridge.Page({}); console.log("changed");'],
  ])('rejects classic delivery with a retained %s in its reachable graph', async (_label, file, source) => {
    output = `${requested}\n${ready}`
    await writeFile(path.join(root, 'pages/render.js'), 'console.log("changed");')
    await writeFile(path.join(root, file), source)
    await expect(fallback.waitForDelivery({
      readOutput: createEmittedScriptReader(path.join(root, 'pages/index.js'), root),
      output: 'pages/index.js',
      marker: 'changed',
      contains: true,
      deadline: Date.now() + 30,
    })).rejects.toThrow('does not match the current source mutation')
    expect(fallback.actualMode).toBe('classic')
  })

  it('rejects a stateful shared script still reachable from the app entry', async () => {
    output = `${requested}\n${ready}`
    await writeFile(path.join(root, 'app.js'), 'require("./shared.js"); App({});')
    await writeFile(path.join(root, 'shared.js'), 'globalThis.__WEAPP_VITE_STATEFUL_HMR_BRIDGE__;')
    await expect(fallback.settle({ deadline: Date.now() + 100 })).rejects.toThrow('active stateful bridge')
  })

  it('checks separate files with the same constant alias without combining their lexical scopes', async () => {
    output = `${requested}\n${ready}`
    await writeFile(path.join(root, 'app.js'), `
      const alias = ${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)};
      exports.WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY = alias;
      require('./shared.js'); App({});
    `)
    await writeFile(path.join(root, 'shared.js'), `
      const alias = ${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_DIRECTORY)};
      exports.WEAPP_VITE_STATEFUL_HMR_DIRECTORY = alias;
    `)
    await expect(fallback.settle({ deadline: Date.now() + 100 })).resolves.toBe(true)
    await writeFile(path.join(root, 'pages/render.js'), `
      const alias = ${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY)};
      exports.WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY = alias;
      require('../shared.js'); console.log('changed');
    `)
    await expect(fallback.waitForDelivery({
      readOutput: createEmittedScriptReader(path.join(root, 'pages/index.js'), root),
      output: 'pages/index.js',
      marker: 'changed',
      contains: true,
      deadline: Date.now() + 100,
    })).resolves.toMatchObject({ delivery: 'classic' })
  })

  it.each([WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY, WEAPP_VITE_STATEFUL_HMR_DIRECTORY])('rejects an executable %s alias in an app dependency', async (key) => {
    output = `${requested}\n${ready}`
    await writeFile(path.join(root, 'app.js'), 'require("./shared.js"); App({});')
    await writeFile(path.join(root, 'shared.js'), `const alias = ${JSON.stringify(key)}; globalThis[alias] = {};`)
    await expect(fallback.settle({ deadline: Date.now() + 100 })).rejects.toThrow(`must remove ${key}`)
  })

  it('rejects a composed control path in an app dependency', async () => {
    output = `${requested}\n${ready}`
    await writeFile(path.join(root, 'app.js'), 'require("./shared.js"); App({});')
    await writeFile(path.join(root, 'shared.js'), `const directory = ${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_DIRECTORY)}; require(directory + '/control.js');`)
    await expect(fallback.settle({ deadline: Date.now() + 100 })).rejects.toThrow(`must remove ${WEAPP_VITE_STATEFUL_HMR_DIRECTORY}`)
  })

  it('still rejects retired control paths in non-script outputs', async () => {
    output = `${requested}\n${ready}`
    await expect(fallback.waitForDelivery({
      readOutput: async () => `<wxs src="/${WEAPP_VITE_STATEFUL_HMR_DIRECTORY}/control.js"/>changed`,
      output: 'pages/index.wxml',
      marker: 'changed',
      contains: true,
      deadline: Date.now() + 100,
    })).rejects.toMatchObject({
      message: 'Classic output does not match the current source mutation.',
      cause: { message: 'Classic fallback output retained a stateful control path.' },
    })
  })

  it('accepts optional runtime capability probes without installing a bridge', async () => {
    output = `${requested}\n${ready}`
    await writeFile(path.join(root, 'pages/render.js'), `
      const key = "__WEAPP_VITE_STATEFUL_HMR_BRIDGE__";
      function readHost() { return globalThis; }
      function register(definition) {
        const bridge = readHost()?.[key];
        if (typeof bridge?.Component === "function") {
          bridge.Component(definition);
          return;
        }
        Component(definition);
      }
      console.log("changed");
    `)
    await expect(fallback.waitForDelivery({
      readOutput: createEmittedScriptReader(path.join(root, 'pages/index.js'), root),
      output: 'pages/index.js',
      marker: 'changed',
      contains: true,
      deadline: Date.now() + 100,
    })).resolves.toMatchObject({ delivery: 'classic' })
  })

  it('rejects an app that still imports the retired client and isolates project evidence', async () => {
    output = `${requested}\n${ready}`
    await writeFile(path.join(root, 'app.js'), 'require("./__weapp_vite_hmr/control.js");')
    await expect(fallback.settle({ deadline: Date.now() + 100 })).rejects.toThrow(`must remove ${WEAPP_VITE_STATEFUL_HMR_DIRECTORY}`)
    const another = new WorkspaceHmrClassicFallback(root, () => '')
    expect(another.requested).toBe(false)
    await expect(another.settle({ deadline: Date.now() + 30 })).rejects.toThrow('no matching ready transition')
    expect(await readFile(path.join(root, 'app.js'), 'utf8')).toContain('__weapp_vite_hmr')
  })
})
