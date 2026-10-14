import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  WEAPP_VITE_LOGICAL_ENTRY_VIRTUAL_PREFIX,
  WEAPP_VITE_SIDECAR_VIRTUAL_PREFIX,
} from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createSidecarModuleId,
  createSidecarModuleSpecifier,
  createSidecarSourceSpecifier,
  parseSidecarModuleId,
  parseSidecarSourceMetadata,
  parseSidecarSourceRequest,
  resolveVirtualModuleId,
} from './protocol'

const directories: string[] = []

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'sidecar-paths-'))
  directories.push(root)
  const first = path.join(root, 'first')
  const second = path.join(root, 'second')
  const alias = path.join(root, 'alias')
  for (const directory of [first, second]) {
    mkdirSync(directory)
    writeFileSync(path.join(directory, 'page.vue'), '')
  }
  symlinkSync(first, alias, 'junction')
  const source = path.join(alias, 'page.vue').replaceAll('\\', '/')
  const expected = [first, second].map(directory => realpathSync.native(path.join(directory, 'page.vue')).replaceAll('\\', '/'))
  return { alias, second, source, expected }
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('protocol path identity', () => {
  it('validates sidecar metadata without resolving file identity', () => {
    const { source } = fixture()
    const owner = encodeURIComponent(source)
    const native = vi.spyOn(realpathSync, 'native')
    expect(parseSidecarSourceMetadata(`${source}?weapp-vite-sidecar-owner=${owner}&weapp-vite-sidecar=style&lang.css`))
      .toMatchObject({ kind: 'style' })
    expect(parseSidecarSourceMetadata(`${source}?raw&weapp-vite-sidecar-owner=${owner}&weapp-vite-sidecar=style&lang.js`))
      .toMatchObject({ kind: 'style', dependencyOnly: true })
    expect(parseSidecarSourceMetadata(`${source}?raw&weapp-vite-sidecar-owner=${owner}&weapp-vite-sidecar=template&lang.js`))
      .toMatchObject({ kind: 'template' })
    expect(parseSidecarSourceMetadata(`${source}?weapp-vite-sidecar-owner=${owner}&weapp-vite-sidecar=script&lang.js`))
      .toBeUndefined()
    expect(native).not.toHaveBeenCalled()
  })

  it.each([
    ['resolved sidecar', (source: string) => createSidecarModuleId(source, source, 'script')],
    ['virtual sidecar', (source: string) => createSidecarModuleSpecifier(source, source, 'script')],
    ['source specifier', (source: string) => createSidecarSourceSpecifier(source, source, 'script')],
    ['parsed sidecar', (source: string) => parseSidecarModuleId(`${WEAPP_VITE_SIDECAR_VIRTUAL_PREFIX}script:${encodeURIComponent(source)}:${encodeURIComponent(source)}:module.js`)],
    ['parsed source', (source: string) => parseSidecarSourceRequest(`${source}?raw&weapp-vite-sidecar-owner=${encodeURIComponent(source)}&weapp-vite-sidecar=script&lang.js`)],
    ['resolved virtual sidecar', (source: string) => resolveVirtualModuleId(`${WEAPP_VITE_SIDECAR_VIRTUAL_PREFIX}script:${encodeURIComponent(source)}:${encodeURIComponent(source)}:module.js`)],
    ['resolved virtual entry', (source: string) => resolveVirtualModuleId(`${WEAPP_VITE_LOGICAL_ENTRY_VIRTUAL_PREFIX}page:${encodeURIComponent(source)}:module.js`)],
  ] as const)('resolves a shared owner/source once for %s and observes the next symlink target', (_name, run) => {
    const { alias, second, source, expected } = fixture()
    const native = vi.spyOn(realpathSync, 'native')
    const initial = run(source)
    expect(native).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(initial)).toContain(typeof initial === 'string' ? encodeURIComponent(expected[0]!) : expected[0]!)
    unlinkSync(alias)
    symlinkSync(second, alias, 'junction')
    native.mockClear()
    const next = run(source)
    expect(native).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(next)).toContain(typeof next === 'string' ? encodeURIComponent(expected[1]!) : expected[1]!)
    expect(next).not.toEqual(initial)
  })

  it('does not touch the filesystem for unrelated or invalid requests', () => {
    const native = vi.spyOn(realpathSync, 'native')
    for (const request of [
      '/project/page.vue?vue&type=style&lang.css',
      '/project/page.vue?raw&weapp-vite-sidecar-owner=%2Fproject%2Fpage.vue&weapp-vite-sidecar=script&lang.css',
      '/project/page.vue?raw&weapp-vite-sidecar=script&lang.js',
    ]) {
      expect(parseSidecarSourceRequest(request)).toBeUndefined()
      expect(parseSidecarSourceMetadata(request)).toBeUndefined()
      expect(resolveVirtualModuleId(request)).toBeUndefined()
    }
    expect(native).not.toHaveBeenCalled()
  })

  it('keeps a distinct owner and external source separate', () => {
    const { source: owner, expected } = fixture()
    const source = expected[1]!
    const native = vi.spyOn(realpathSync, 'native')
    const request = `${WEAPP_VITE_SIDECAR_VIRTUAL_PREFIX}style:${encodeURIComponent(owner)}:${encodeURIComponent(source)}:module.js`
    expect(parseSidecarModuleId(request)).toEqual({ kind: 'style', ownerId: expected[0], sourceId: source })
    expect(native).toHaveBeenCalledTimes(2)
    native.mockClear()
    const resolved = resolveVirtualModuleId(request)!
    expect(native).toHaveBeenCalledTimes(2)
    expect(parseSidecarModuleId(resolved)).toEqual({ kind: 'style', ownerId: expected[0], sourceId: source })
  })
})
