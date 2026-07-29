import type { ScanState } from '../src/plugin/types'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizePath } from '../src/plugin/path'
import { getStableWebComponentId, scanProject } from '../src/plugin/scan'
import { createEmptyScanState } from '../src/plugin/state'

async function writeFixtureFile(pathname: string, content = '') {
  await mkdir(dirname(pathname), { recursive: true })
  await writeFile(pathname, content)
}

function expectCleanState(state: ScanState) {
  expect(state.moduleMeta.size).toBeGreaterThan(0)
  expect(state.sfcResults.size).toBe(0)
}

describe('web project scanner contracts', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('normalizes local, external and Windows component ids', () => {
    expect(getStableWebComponentId('/workspace/src/components/card.ts', '/workspace/src'))
      .toBe('components/card')
    expect(getStableWebComponentId('/workspace/node_modules/@demo/card/index.vue', '/workspace/src'))
      .toBe('__external__/@demo/card/index')
    expect(getStableWebComponentId('C:\\repo\\node_modules\\demo\\card.js', 'C:\\repo\\src'))
      .toBe('__external__/demo/card')
  })

  it('scans duplicate, missing and headless components with malformed subpackages', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-scan-contract-'))
    const srcRoot = join(root, 'src')
    const shared = join(srcRoot, 'components/shared/index.js')
    const headless = join(srcRoot, 'components/headless/index.js')
    const unstable = join(root, 'node_modules/unstable/index.js')
    await writeFixtureFile(join(srcRoot, 'app.js'), 'App({})')
    await writeFixtureFile(join(srcRoot, 'app.json'), JSON.stringify({
      pages: ['pages/index/index', 'pages/missing/index', 1],
      usingComponents: {
        empty: '',
        local: '/components/shared/index',
        localMissing: '/components/missing/index',
        package: 'shared-package',
        packageAgain: 'shared-package',
        unstable: 'unstable-package',
        missing: 'missing-package',
      },
      subPackages: [
        null,
        'invalid',
        {},
        { pages: 'invalid' },
        { root: 1, pages: [1, 'pages/missing/index'] },
        { root: 'package-a', pages: ['pages/detail/index'] },
      ],
      window: {
        navigationBarTitleText: 'Contract',
      },
    }))
    await writeFixtureFile(join(srcRoot, 'pages/index/index.js'), 'Page({})')
    await writeFixtureFile(join(srcRoot, 'pages/index/index.wxml'), '<view />')
    await writeFixtureFile(join(srcRoot, 'pages/index/index.json'), JSON.stringify({
      usingComponents: {
        headless: '/components/headless/index',
      },
    }))
    await writeFixtureFile(join(srcRoot, 'package-a/pages/detail/index.js'), 'Page({})')
    await writeFixtureFile(join(srcRoot, 'package-a/pages/detail/index.wxml'), '<view />')
    await writeFixtureFile(shared, 'Component({})')
    await writeFixtureFile(shared.replace(/\.js$/, '.wxml'), '<view />')
    await writeFixtureFile(headless, 'Component({})')
    await writeFixtureFile(unstable, 'Component({})')
    await writeFixtureFile(join(srcRoot, 'layouts/index.js'), 'Component({})')
    await writeFixtureFile(join(srcRoot, 'layouts/group/index/index.js'), 'Component({})')
    await writeFixtureFile(join(srcRoot, 'layouts/group/index/index.wxml'), '<slot />')
    await writeFixtureFile(join(srcRoot, 'layouts/plain/index.js'), 'Component({})')

    let unstableCalls = 0
    const resolveId = vi.fn(async (source: string) => {
      if (source === 'shared-package') {
        return shared
      }
      if (source === 'unstable-package') {
        unstableCalls += 1
        return unstableCalls === 1 ? unstable : undefined
      }
      return undefined
    })
    const warn = vi.fn()
    const state = createEmptyScanState()
    state.moduleMeta.set('stale', {} as any)
    state.pageNavigationMap.set('stale', {})
    state.templateComponentMap.set('stale', {})
    state.templatePathSet.add('stale')
    state.componentTagMap.set('stale', 'stale')
    state.sfcResults.set('stale', {} as any)

    await scanProject({ srcRoot, state, resolveId, warn })

    expectCleanState(state)
    expect(state.moduleMeta.has('stale')).toBe(false)
    expect(state.scanResult.pages.map(page => page.id)).toEqual([
      'pages/index/index',
      'package-a/pages/detail/index',
    ])
    expect(state.scanResult.components).toEqual(expect.arrayContaining([
      expect.objectContaining({ script: normalizePath(shared), importId: 'shared-package' }),
      expect.objectContaining({ script: normalizePath(headless) }),
    ]))
    expect(state.scanResult.components.some(component => component.script === normalizePath(unstable))).toBe(false)
    expect(state.scanResult.layouts).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'group' }),
      expect.objectContaining({ name: 'plain' }),
    ]))
    expect(state.appNavigationDefaults).toMatchObject({ title: 'Contract' })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('empty'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('localMissing'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('missing-package'))
  })

  it('uses legacy subpackages and the process warning fallback', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-scan-legacy-subpackages-'))
    const srcRoot = join(root, 'src')
    await writeFixtureFile(join(srcRoot, 'app.js'), 'App({})')
    await writeFixtureFile(join(srcRoot, 'app.json'), JSON.stringify({
      pages: [],
      usingComponents: { missing: 'missing-package' },
      subpackages: [{ pages: ['pages/detail/index'] }],
      window: 'invalid',
    }))
    await writeFixtureFile(join(srcRoot, 'pages/detail/index.js'), 'Page({})')
    await writeFixtureFile(join(srcRoot, 'pages/detail/index.wxml'), '<view />')
    await writeFixtureFile(join(srcRoot, 'pages/detail/index.json'), JSON.stringify({
      usingComponents: { card: '/components/card/index' },
    }))
    await writeFixtureFile(join(srcRoot, 'components/card/index.js'), 'Component({})')
    await writeFixtureFile(join(srcRoot, 'components/card/index.wxml'), '<view />')

    const emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => {})
    const state = createEmptyScanState()
    await scanProject({ srcRoot, state })

    expect(state.scanResult.pages).toEqual([
      expect.objectContaining({ id: 'pages/detail/index' }),
    ])
    expect(state.appNavigationDefaults).toEqual({})
    expect(emitWarning).toHaveBeenCalledWith(expect.stringContaining('missing-package'))
  })

  it('uses the host-resolved app config for auto-routes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-scan-host-config-'))
    const srcRoot = join(root, 'src')
    const appJsonPath = join(srcRoot, 'app.json.ts')
    await writeFixtureFile(join(srcRoot, 'app.js'), 'App({})')
    await writeFixtureFile(appJsonPath, 'export default { pages: [\'pages/index/index\'] }')
    await writeFixtureFile(join(srcRoot, 'pages/index/index.js'), 'Page({})')
    await writeFixtureFile(join(srcRoot, 'pages/detail/index.js'), 'Page({})')

    const resolveAppConfig = vi.fn(async () => ({
      pages: ['pages/index/index', 'pages/detail/index'],
    }))
    const state = createEmptyScanState()

    await scanProject({ srcRoot, state, resolveAppConfig })

    expect(resolveAppConfig).toHaveBeenCalledWith(normalizePath(appJsonPath))
    expect(state.scanResult.pages.map(page => page.id)).toEqual([
      'pages/index/index',
      'pages/detail/index',
    ])
  })
})
