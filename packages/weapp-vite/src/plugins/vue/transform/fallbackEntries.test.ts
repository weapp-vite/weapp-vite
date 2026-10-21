import type { CompilerContext } from '../../../context'
import type { AppEntry } from '../../../types'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { collectVuePages } from './collectVuePages'
import { collectFallbackPageEntryIds } from './fallbackEntries'

const roots: string[] = []

async function fixture(json: AppEntry['json'], currentSubPackageRoot?: string) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-fallback-owner-'))
  roots.push(root)
  const absoluteSrcRoot = path.join(root, 'src')
  const appEntry: AppEntry = {
    type: 'app',
    path: path.join(absoluteSrcRoot, 'app.ts'),
    jsonPath: path.join(absoluteSrcRoot, 'app.json'),
    json,
  }
  const configService = {
    cwd: root,
    absoluteSrcRoot,
    currentSubPackageRoot,
  } as CompilerContext['configService']
  const scanService = {
    appEntry,
    loadAppEntry: vi.fn(async () => appEntry),
  } as unknown as CompilerContext['scanService']
  const write = async (relative: string, source = '<template><view /></template>') => {
    const file = path.join(absoluteSrcRoot, relative)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, source)
  }
  const entries = async () => Array.from(await collectFallbackPageEntryIds(configService, scanService))
    .map(file => path.relative(absoluteSrcRoot, file))
    .sort()
  return { root, absoluteSrcRoot, configService, scanService, write, entries }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

describe('fallback page output ownership', () => {
  it('keeps Vue, TSX and JSX discovery identities without stripping the basename twice', async () => {
    const project = await fixture({ pages: [] })
    project.scanService.appEntry = undefined
    for (const file of ['pages/vue/index.vue', 'pages/tsx/index.tsx', 'pages/jsx/index.jsx', 'pages/native/index.ts']) {
      await project.write(file)
    }
    const expected = ['pages/jsx/index', 'pages/tsx/index', 'pages/vue/index']
    expect((await collectVuePages(path.join(project.absoluteSrcRoot, 'pages')))
      .map(file => path.relative(project.absoluteSrcRoot, file)).sort()).toEqual(expected)
    expect(await project.entries()).toEqual(expected)
  })

  it('retains ordinary subpackage pages and excludes independent roots at directory boundaries', async () => {
    const project = await fixture({
      pages: ['pages/main/index', 'pages/isolated-extra/index'],
      subPackages: [
        { root: 'packages/ordinary', pages: ['outside-pages/index'] },
        { root: 'pages/isolated', pages: ['index'], independent: true },
      ],
    })
    await project.write('pages/main/index.vue')
    await project.write('packages/ordinary/outside-pages/index.vue')
    await project.write('pages/isolated/index.vue')
    await project.write('pages/isolated-extra/index.vue')
    await project.write('pages/unregistered/index.vue')
    expect(await project.entries()).toEqual([
      'packages/ordinary/outside-pages/index',
      'pages/isolated-extra/index',
      'pages/main/index',
    ])
  })

  it('does not discover unregistered Vue files when an empty source page registry exists', async () => {
    const project = await fixture({ pages: [] })
    await project.write('pages/unregistered/index.vue')
    expect(await project.entries()).toEqual([])
  })

  it('collects only this independent package registered entries without scanning main or sibling pages', async () => {
    const project = await fixture({
      pages: ['pages/main/index'],
      subpackages: [
        { root: 'packages/independent', pages: ['native/index', 'pages/vue/index'], independent: true },
        { root: 'packages/sibling', pages: ['pages/vue/index'], independent: true },
        { root: 'packages/ordinary', pages: ['pages/vue/index'] },
      ],
    }, '/packages/independent/')
    for (const file of [
      'pages/main/index.vue',
      'packages/independent/pages/vue/index.vue',
      'packages/independent/pages/unregistered/index.vue',
      'packages/sibling/pages/vue/index.vue',
      'packages/ordinary/pages/vue/index.vue',
    ]) {
      await project.write(file)
    }
    expect(await project.entries()).toEqual([
      'packages/independent/native/index',
      'packages/independent/pages/vue/index',
    ])
  })

  it('loads the source app registry for a fresh independent compiler instead of stale published pages', async () => {
    const project = await fixture({
      pages: ['pages/main/index'],
      subPackages: [{ root: 'packages/independent', pages: ['native/index'], independent: true }],
    }, 'packages/independent')
    project.scanService.appEntry = undefined
    await fs.mkdir(path.join(project.root, 'dist'), { recursive: true })
    await fs.writeFile(path.join(project.root, 'dist/app.json'), JSON.stringify({ pages: ['pages/stale/index'] }))
    await project.write('pages/main/index.vue')
    expect(await project.entries()).toEqual(['packages/independent/native/index'])
    expect(project.scanService.loadAppEntry).toHaveBeenCalledOnce()
  })

  it('keeps ordinary subpackage pages when only the published app registry is available', async () => {
    const project = await fixture({ pages: [] })
    project.scanService.appEntry = undefined
    await fs.mkdir(path.join(project.root, 'dist'), { recursive: true })
    await fs.writeFile(path.join(project.root, 'dist/app.json'), JSON.stringify({
      pages: ['pages/main/index'],
      subpackages: [
        { root: 'packages/ordinary', pages: ['index'] },
        { root: 'packages/independent', pages: ['index'], independent: true },
      ],
    }))
    expect(await project.entries()).toEqual(['packages/ordinary/index', 'pages/main/index'])
  })

  it('does not substitute the main registry when the current independent root is absent', async () => {
    const project = await fixture({ pages: ['pages/main/index'] }, 'packages/removed')
    await project.write('pages/main/index.vue')
    expect(await project.entries()).toEqual([])
  })

  it('preserves a source registry failure instead of substituting a stale publication for an independent build', async () => {
    const project = await fixture({ pages: [] }, 'packages/independent')
    project.scanService.appEntry = undefined
    const error = new Error('invalid source app registry')
    vi.mocked(project.scanService.loadAppEntry).mockRejectedValueOnce(error)
    await fs.mkdir(path.join(project.root, 'dist'), { recursive: true })
    await fs.writeFile(path.join(project.root, 'dist/app.json'), JSON.stringify({ pages: ['pages/stale/index'] }))
    await expect(project.entries()).rejects.toBe(error)
  })

  it('honors configuration-selected independent ownership for main fallback pages', async () => {
    const project = await fixture({
      pages: ['pages/main/index'],
      subPackages: [{ root: 'packages/configured', pages: ['index'] }],
    })
    Object.assign(project.configService, { weappViteConfig: { subPackages: { 'packages/configured': { independent: true } } } })
    expect(await project.entries()).toEqual(['pages/main/index'])
  })
})
