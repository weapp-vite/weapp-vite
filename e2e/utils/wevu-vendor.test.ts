import os from 'node:os'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { findMissingWevuVendorExports, waitForWevuSharedRuntimeChunkContaining } from './wevu-vendor'
import { collectCommonJsExportNames } from './wevu-vendor-exports'

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map(tempRoot => fs.remove(tempRoot)))
})

describe('wevu vendor helpers', () => {
  it.each([
    'exports.createApp = a; exports.setWevuDefaults = b;',
    'Object.defineProperty(exports, "createApp", { get: () => a }); Object.defineProperty(exports, "setWevuDefaults", { get: () => b });',
  ])('accepts public runtime exports independently of their emitted form: %s', (source) => {
    expect([...collectCommonJsExportNames(source)].sort()).toEqual(['createApp', 'setWevuDefaults'])
    expect(collectCommonJsExportNames('runtime.createApp(); const setWevuDefaults = 1').size).toBe(0)
  })

  it('checks runtime vendor member references against emitted exports', async () => {
    const distRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wevu-vendor-'))
    tempRoots.push(distRoot)
    await fs.outputFile(
      path.join(distRoot, 'weapp-vendors/wevu-runtime.js'),
      'Object.defineProperty(exports, "getMiniProgramGlobalObject", { enumerable: true, get: () => getMiniProgramGlobalObject });',
    )
    await fs.outputFile(
      path.join(distRoot, 'pages/index.js'),
      'const runtime = require("../weapp-vendors/wevu-runtime.js"); runtime.getMiniProgramGlobalObject();',
    )

    expect(await findMissingWevuVendorExports(distRoot)).toEqual([])

    await fs.writeFile(path.join(distRoot, 'weapp-vendors/wevu-runtime.js'), 'module.exports = {}')
    expect(await findMissingWevuVendorExports(distRoot)).toEqual([
      'weapp-vendors/wevu-runtime.js#getMiniProgramGlobalObject',
    ])
  })

  it('checks relative imports between vendor chunks', async () => {
    const distRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wevu-vendor-'))
    tempRoots.push(distRoot)
    await fs.outputFile(
      path.join(distRoot, 'weapp-vendors/wevu-reactivity.js'),
      'Object.defineProperty(exports, "getCurrentInstance", { enumerable: true, get: () => getCurrentInstance });',
    )
    await fs.outputFile(
      path.join(distRoot, 'weapp-vendors/wevu-runtime.js'),
      'const reactivity = require("./wevu-reactivity.js"); reactivity.getMiniProgramGlobalObject();',
    )

    expect(await findMissingWevuVendorExports(distRoot)).toEqual([
      'weapp-vendors/wevu-reactivity.js#getMiniProgramGlobalObject',
    ])

    await fs.writeFile(
      path.join(distRoot, 'weapp-vendors/wevu-reactivity.js'),
      'Object.defineProperty(exports, "getMiniProgramGlobalObject", { enumerable: true, get: () => getMiniProgramGlobalObject });',
    )
    expect(await findMissingWevuVendorExports(distRoot)).toEqual([])
  })

  it.each([
    'const host = require("../weapp-vendors/web-runtime.js").install(); host.fetch(); host.EventSource;',
    'const host = require("../weapp-vendors/web-runtime.js")["install"]({}) || globalThis; host.fetch(); host.EventSource;',
  ])('checks the installer export without treating its returned host as a namespace: %s', async (source) => {
    const distRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wevu-vendor-'))
    tempRoots.push(distRoot)
    const vendor = path.join(distRoot, 'weapp-vendors/web-runtime.js')
    await fs.outputFile(vendor, 'exports.install = () => globalThis;')
    await fs.outputFile(path.join(distRoot, 'pages/index.js'), source)

    expect(await findMissingWevuVendorExports(distRoot)).toEqual([])

    await fs.writeFile(vendor, 'module.exports = {}')
    expect(await findMissingWevuVendorExports(distRoot)).toEqual([
      'weapp-vendors/web-runtime.js#install',
    ])
  })

  it.each([
    'const runtime = require("../weapp-vendors/web-runtime.js"); function nested(runtime) { runtime.fetch(); } runtime.install();',
    'const runtime = require("../weapp-vendors/web-runtime.js"); { const runtime = {}; runtime.fetch(); } runtime.install();',
    'import * as runtime from "../weapp-vendors/web-runtime.js"; function nested(runtime) { runtime.fetch(); } runtime.install();',
    'function nested(require) { const runtime = require("../weapp-vendors/web-runtime.js"); runtime.fetch(); }',
    'const description = \'const runtime = require("../weapp-vendors/web-runtime.js"); runtime.fetch();\';',
  ])('ignores references owned by another binding or non-code text: %s', async (source) => {
    const distRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wevu-vendor-'))
    tempRoots.push(distRoot)
    await fs.outputFile(path.join(distRoot, 'weapp-vendors/web-runtime.js'), 'exports.install = () => globalThis;')
    await fs.outputFile(path.join(distRoot, 'pages/index.js'), source)

    expect(await findMissingWevuVendorExports(distRoot)).toEqual([])
  })

  it.each([
    'require("../weapp-vendors/web-runtime.js").missing();',
    'require("../weapp-vendors/web-runtime.js")["missing"]();',
    'const runtime = require("../weapp-vendors/web-runtime.js"); runtime?.missing();',
    'const { missing: renamed } = require("../weapp-vendors/web-runtime.js"); renamed();',
    'import * as runtime from "../weapp-vendors/web-runtime.js"; runtime.missing();',
    'import { missing as renamed } from "../weapp-vendors/web-runtime.js"; renamed();',
  ])('continues reporting real missing imported members: %s', async (source) => {
    const distRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wevu-vendor-'))
    tempRoots.push(distRoot)
    await fs.outputFile(path.join(distRoot, 'weapp-vendors/web-runtime.js'), 'exports.install = () => globalThis;')
    await fs.outputFile(path.join(distRoot, 'pages/index.js'), source)

    expect(await findMissingWevuVendorExports(distRoot)).toEqual([
      'weapp-vendors/web-runtime.js#missing',
    ])
  })

  it('waits for a shared chunk instead of returning an intermediate page output', async () => {
    const distRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wevu-vendor-'))
    tempRoots.push(distRoot)
    const marker = 'SHARED-RUNTIME-CONVERGENCE'
    await fs.outputFile(
      path.join(distRoot, 'pages/store/index.js'),
      `const pageMarker = "${marker}";`,
    )

    const pendingChunk = waitForWevuSharedRuntimeChunkContaining(distRoot, [marker], 2_000)
    await new Promise(resolve => setTimeout(resolve, 50))
    await fs.outputFile(
      path.join(distRoot, 'common.js'),
      `const sharedMarker = "${marker}";`,
    )

    const chunk = await pendingChunk
    expect(path.relative(distRoot, chunk.path).replaceAll('\\', '/')).toBe('common.js')
  })
})
