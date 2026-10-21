import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureVendorPublicationSnapshot, waitForVendorMembersIntact } from './index'
import { inspectVendorMembers } from './scanner'

const io = vi.hoisted(() => ({
  readdir: vi.fn<(root: string, options: unknown) => Promise<string[]>>(),
  readFile: vi.fn<(file: string, options: { encoding: string, signal?: AbortSignal }) => Promise<string>>(),
}))

vi.mock('@weapp-core/shared/node', () => ({ fs: io }))

const DIST_ROOT = path.resolve('vendor-publication-fixture')
const APP_FILE = 'pages/home/home.js'
const VENDOR_FILE = 'weapp-vendors/runtime.js'
const APP_SOURCE = `
const runtime = require("../../weapp-vendors/runtime.js");
runtime.ref();
require("../../weapp-vendors/runtime.js").computed();
const { reactive: state } = require("../../weapp-vendors/runtime.js");
`
const VENDOR_SOURCE = ['ref', 'computed', 'reactive']
  .map(name => `Object.defineProperty(exports, "${name}", { get() {} });`)
  .join('\n')

function installPublication(files = new Map([[APP_FILE, APP_SOURCE], [VENDOR_FILE, VENDOR_SOURCE]])) {
  io.readdir.mockImplementation(async () => [...files.keys()])
  io.readFile.mockImplementation(async (file) => {
    const relative = path.relative(DIST_ROOT, file).replaceAll('\\', '/')
    const source = files.get(relative)
    if (source === undefined) {
      throw Object.assign(new Error(`Missing ${relative}`), { code: 'ENOENT' })
    }
    return source
  })
  return files
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('vendor publication snapshots', () => {
  it('checks direct, namespace and destructured member references from the same snapshot', async () => {
    installPublication()
    const result = expect(waitForVendorMembersIntact(DIST_ROOT, 1_000)).resolves.toEqual({})
    await vi.advanceTimersByTimeAsync(250)
    await result
    expect(io.readFile).toHaveBeenCalledTimes(4)
  })

  it('does not treat namespace names in module paths, strings or comments as member reads', () => {
    const source = `${APP_SOURCE}
const message = "runtime.notExported";
// runtime.notExported
/* runtime.notExported */
`
    expect(inspectVendorMembers(new Map([[APP_FILE, source], [VENDOR_FILE, VENDOR_SOURCE]]), DIST_ROOT))
      .toEqual({ missingByFile: {}, referencedMembers: 3 })
  })

  it('ignores shadowed namespace and require bindings', () => {
    const source = `${APP_SOURCE}
function otherRuntime(runtime) { runtime.notExported(); }
function otherRequire(require) { require("../../weapp-vendors/runtime.js").notExported(); }
`
    expect(inspectVendorMembers(new Map([[APP_FILE, source], [VENDOR_FILE, VENDOR_SOURCE]]), DIST_ROOT))
      .toEqual({ missingByFile: {}, referencedMembers: 3 })
  })

  it('reads single quoted module requests and static namespace, direct and destructured keys', () => {
    const source = `
const runtime = require('../../weapp-vendors/runtime.js');
runtime['ref']();
require('../../weapp-vendors/runtime.js')['computed']();
const { 'reactive': state } = require('../../weapp-vendors/runtime.js');
`
    expect(inspectVendorMembers(new Map([[APP_FILE, source], [VENDOR_FILE, VENDOR_SOURCE]]), DIST_ROOT))
      .toEqual({ missingByFile: {}, referencedMembers: 3 })
  })

  it('reports a missing statically computed namespace member', () => {
    const source = `const runtime = require('../../weapp-vendors/runtime.js'); runtime['absent']();`
    expect(inspectVendorMembers(new Map([[APP_FILE, source], [VENDOR_FILE, VENDOR_SOURCE]]), DIST_ROOT))
      .toEqual({ missingByFile: { [APP_FILE]: [`${VENDOR_FILE}#absent`] }, referencedMembers: 1 })
  })

  it('does not mistake strings or comments for real vendor exports', () => {
    const source = `require('../../weapp-vendors/runtime.js').absent();`
    const vendor = `
'Object.defineProperty(exports, "absent", {});';
// Object.defineProperty(exports, "absent", {});
`
    expect(inspectVendorMembers(new Map([[APP_FILE, source], [VENDOR_FILE, vendor]]), DIST_ROOT))
      .toEqual({ missingByFile: { [APP_FILE]: [`${VENDOR_FILE}#absent`] }, referencedMembers: 1 })
  })

  it.each([
    `function localObject(Object) { Object.defineProperty(exports, 'absent', {}); }`,
    `function localExports(exports) { Object.defineProperty(exports, 'absent', {}); }`,
  ])('rejects locally shadowed Object or exports declarations: %s', (vendor) => {
    const source = `require('../../weapp-vendors/runtime.js').absent();`
    expect(inspectVendorMembers(new Map([[APP_FILE, source], [VENDOR_FILE, vendor]]), DIST_ROOT))
      .toEqual({ missingByFile: { [APP_FILE]: [`${VENDOR_FILE}#absent`] }, referencedMembers: 1 })
  })

  it('preserves malformed JavaScript as an error instead of accepting an empty scan', () => {
    expect(() => inspectVendorMembers(new Map([[APP_FILE, 'const = invalid;']]), DIST_ROOT)).toThrow(SyntaxError)
  })

  it('retries when a chunk disappears after enumeration and checks the replacement publication', async () => {
    installPublication()
    io.readdir.mockResolvedValueOnce([APP_FILE, 'weapp-vendors/retired.js'])
    const result = expect(waitForVendorMembersIntact(DIST_ROOT, 1_000)).resolves.toEqual({})
    await vi.advanceTimersByTimeAsync(500)
    await result
    expect(io.readFile).toHaveBeenCalledWith(path.join(DIST_ROOT, 'weapp-vendors/retired.js'), expect.objectContaining({ encoding: 'utf8' }))
    expect(io.readFile).toHaveBeenCalledWith(path.join(DIST_ROOT, VENDOR_FILE), expect.objectContaining({ encoding: 'utf8' }))
  })

  it('rejects a snapshot whose file set changes during reading', async () => {
    installPublication()
    io.readdir
      .mockResolvedValueOnce([APP_FILE, VENDOR_FILE])
      .mockResolvedValueOnce([APP_FILE, VENDOR_FILE, 'pages/next/index.js'])
    await expect(captureVendorPublicationSnapshot(DIST_ROOT)).resolves.toBeUndefined()
  })

  it('waits for identical file contents across two consecutive complete snapshots', async () => {
    const files = installPublication()
    let enumerations = 0
    io.readdir.mockImplementation(async () => {
      if (++enumerations === 3) {
        files.set(APP_FILE, `${APP_SOURCE}\nconsole.log("next publication");`)
      }
      return [...files.keys()]
    })
    let settled = false
    const pending = waitForVendorMembersIntact(DIST_ROOT, 1_000).then((result) => {
      settled = true
      return result
    })
    const result = expect(pending).resolves.toEqual({})
    await vi.advanceTimersByTimeAsync(250)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(250)
    await result
    expect(enumerations).toBe(6)
  })

  it('fails within the original budget when a referenced vendor module stays missing', async () => {
    installPublication(new Map([[APP_FILE, APP_SOURCE]]))
    const result = expect(waitForVendorMembersIntact(DIST_ROOT, 1_000))
      .rejects
      .toThrow('weapp-vendors/runtime.js#ref (module missing)')
    await vi.advanceTimersByTimeAsync(1_000)
    await result
  })

  it('continues to fail when the vendor module omits a referenced export', async () => {
    installPublication(new Map([[APP_FILE, APP_SOURCE], [VENDOR_FILE, 'Object.defineProperty(exports, "ref", {});']]))
    const result = expect(waitForVendorMembersIntact(DIST_ROOT, 1_000))
      .rejects
      .toThrow('weapp-vendors/runtime.js#computed')
    await vi.advanceTimersByTimeAsync(1_000)
    await result
  })

  it.each([
    { name: 'empty publication', files: new Map<string, string>(), message: 'no JavaScript files' },
    { name: 'publication without vendor references', files: new Map([[APP_FILE, 'Page({});']]), message: 'no vendor member references' },
  ])('does not pass $name without observing vendor references', async ({ files, message }) => {
    installPublication(files)
    const result = expect(waitForVendorMembersIntact(DIST_ROOT, 1_000)).rejects.toThrow(message)
    await vi.advanceTimersByTimeAsync(1_000)
    await result
  })

  it('preserves a real filesystem read error instead of retrying it as publication churn', async () => {
    installPublication()
    const error = Object.assign(new Error('Cannot read emitted file'), { code: 'EACCES' })
    io.readFile.mockRejectedValueOnce(error)
    await expect(waitForVendorMembersIntact(DIST_ROOT, 1_000)).rejects.toBe(error)
  })

  it('fails when an identical second snapshot finishes after the absolute deadline', async () => {
    const files = installPublication()
    let enumerations = 0
    io.readdir.mockImplementation(async () => {
      if (++enumerations === 4) {
        vi.setSystemTime(Date.now() + 1_000)
      }
      return [...files.keys()]
    })
    const result = expect(waitForVendorMembersIntact(DIST_ROOT, 1_000))
      .rejects
      .toThrow('Timed out waiting for vendor members')
    await vi.advanceTimersByTimeAsync(250)
    await result
    expect(enumerations).toBe(4)
  })

  it('bounds a hanging file read and aborts its outstanding read signal', async () => {
    installPublication()
    io.readFile.mockImplementationOnce(() => new Promise(() => {}))
    const result = expect(waitForVendorMembersIntact(DIST_ROOT, 1_000))
      .rejects
      .toThrow('Timed out waiting for vendor members')
    await vi.advanceTimersByTimeAsync(1_000)
    await result
    expect(io.readFile.mock.calls[0]?.[1].signal?.aborted).toBe(true)
  })
})
