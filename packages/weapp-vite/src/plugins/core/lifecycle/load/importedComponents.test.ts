import { mkdir, mkdtemp, readFile, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogicalEntryId } from '../../../../moduleGraph/protocol'
import { collectImportedVueComponents } from './importedComponents'
import { createOptionsHook } from './options'

let root: string

async function source(file: string, code: string) {
  const target = path.join(root, file)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, code)
  return target
}

function createState(pages: string[]) {
  const appEntry = { path: path.join(root, 'app.ts'), json: { pages } }
  return {
    ctx: {
      configService: {
        absoluteSrcRoot: root,
        isDev: false,
        platform: 'weapp',
        packageJson: { dependencies: {} },
        weappViteConfig: {},
        options: {},
        relativeAbsoluteSrcRoot: (id: string) => path.relative(root, id),
        relativeOutputPath: (id: string) => path.relative(root, id),
      },
      scanService: {
        appEntry,
        loadAppEntry: async () => appEntry,
        loadSubPackages: vi.fn(),
        drainIndependentDirtyRoots: () => [],
        independentSubPackageMap: new Map(),
      },
      runtimeState: {
        lib: { enabled: false, entries: new Map() },
        autoRoutes: { pageSourceFiles: new Set<string>() },
        build: { independent: { outputs: new Map(), pendingOutputs: [] }, hmr: { profile: {} } },
      },
      buildService: {},
    },
    entriesMap: new Map(),
  }
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'page-import-discovery-'))
  await source('app.ts', 'App({})')
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(root, { recursive: true, force: true })
})

describe('page import discovery scheduling', () => {
  it('bounds concurrent page reads and preserves declaration order after reversed completion', async () => {
    const pages = Array.from({ length: 10 }, (_, index) => `pages/page-${index}`)
    const pending = new Map<string, () => void>()
    const completed: string[] = []
    const pageFiles = new Set<string>()
    for (const [index, page] of pages.entries()) {
      pageFiles.add(await source(`${page}.vue`, `<script setup>import Card from '../components/card-${index}.vue'</script>`))
      await source(`components/card-${index}.vue`, '<template><view /></template>')
    }
    let holding = true
    let active = 0
    let peak = 0
    vi.spyOn(fs, 'readFile').mockImplementation(async (...args) => {
      const file = String(args[0])
      if (pageFiles.has(file)) {
        active += 1
        peak = Math.max(peak, active)
        try {
          const value = await readFile(...args)
          if (holding) {
            await new Promise<void>((resolve) => {
              pending.set(file, resolve)
            })
          }
          completed.push(file)
          return value
        }
        finally {
          active -= 1
        }
      }
      return readFile(...args)
    })
    const state = createState(pages)
    const options: { input?: Record<string, string> } = {}
    const task = createOptionsHook(state as any)(options)
    const reversedPages = pages.slice(0, 8).map(page => path.join(root, `${page}.vue`)).reverse()
    try {
      await vi.waitFor(() => expect(pending.size).toBe(8))
      expect(active).toBe(8)
      holding = false
      for (const file of reversedPages) {
        pending.get(file)!()
        await vi.waitFor(() => expect(completed).toContain(file))
      }
    }
    finally {
      holding = false
      for (const release of [...pending.values()].reverse()) {
        release()
      }
      await task
    }
    expect(peak).toBe(8)
    expect(active).toBe(0)
    expect(completed.slice(0, 8)).toEqual(reversedPages)
    expect(Object.keys(options.input!)).toEqual([
      'app',
      ...pages,
      ...pages.map((_, index) => `components/card-${index}`),
    ])
    for (const [index, page] of pages.entries()) {
      expect(options.input?.[page]).toBe(createLogicalEntryId(path.join(root, `${page}.vue`), 'page'))
      expect(options.input?.[`components/card-${index}`]).toBe(createLogicalEntryId(path.join(root, `components/card-${index}.vue`), 'component'))
    }
  })

  it('waits for the admitted batch and retains the first error in declaration order', async () => {
    const first = await source('pages/first.vue', '<template><view /></template>')
    const second = await source('pages/second.vue', '<template><view /></template>')
    const remaining = await Promise.all(Array.from({ length: 8 }, (_, index) => source(`pages/remaining-${index}.vue`, '<template><view /></template>')))
    const firstError = new Error('first page resolution failed')
    const secondError = new Error('second page resolution failed')
    const release = Promise.withResolvers<void>()
    const entered: string[] = []
    let firstCompleted = false
    const originalExists = fs.pathExists.bind(fs)
    vi.spyOn(fs, 'pathExists').mockImplementation(async (file) => {
      const name = String(file)
      if (name === first) {
        entered.push(name)
        await release.promise
        firstCompleted = true
        throw firstError
      }
      if (name === second) {
        entered.push(name)
        throw secondError
      }
      if (remaining.includes(name)) {
        entered.push(name)
      }
      return originalExists(file)
    })
    const task = collectImportedVueComponents(createState([]) as any, [
      { entry: 'pages/first.vue', type: 'page' },
      { entry: 'pages/second.vue', type: 'page' },
      ...remaining.map(entry => ({ entry: path.relative(root, entry), type: 'page' as const })),
    ])
    const rejected = expect(task).rejects.toBe(firstError)
    try {
      await vi.waitFor(() => expect(entered).toEqual([first, second, ...remaining.slice(0, 6)]))
      expect(firstCompleted).toBe(false)
    }
    finally {
      release.resolve()
      await rejected
    }
    expect(firstCompleted).toBe(true)
    expect(entered).toEqual([first, second, ...remaining.slice(0, 6)])
  })

  it('retains missing/read-failure behavior without discarding other page imports', async () => {
    const broken = await source('pages/broken.vue', '<template><view /></template>')
    await source('pages/ready.vue', `<script setup>
import First from '../components/first.vue'
import Again from '../components/first.vue'
import Second from '../components/second.vue'
</script>`)
    await source('components/first.vue', '<template><view /></template>')
    await source('components/second.vue', '<template><view /></template>')
    vi.spyOn(fs, 'readFile').mockImplementation(async (...args) => {
      if (String(args[0]) === broken) {
        throw new Error('page read failed')
      }
      return readFile(...args)
    })
    await expect(collectImportedVueComponents(createState([]) as any, [
      { entry: 'pages/missing', type: 'page' },
      { entry: 'pages/broken.vue', type: 'page' },
      { entry: 'pages/ready.vue', type: 'page' },
      { entry: 'pages/broken.vue', type: 'component' },
      { entry: 'plugin://external', type: 'page' },
    ])).resolves.toEqual(['components/first.vue', 'components/second.vue'])
  })

  it('rereads same-size edits and atomic replacements in each options context', async () => {
    const code = (component: string) => `<script setup>import Card from '../components/${component}.vue'</script>`
    const page = await source('pages/current.vue', code('first'))
    await source('components/first.vue', '<template><view /></template>')
    await source('components/other.vue', '<template><view /></template>')
    const candidates = [{ entry: 'pages/current.vue', type: 'page' as const }]
    const state = createState([])
    await expect(collectImportedVueComponents(state as any, candidates)).resolves.toEqual(['components/first.vue'])
    expect(code('first').length).toBe(code('other').length)
    await writeFile(page, code('other'))
    await expect(collectImportedVueComponents(state as any, candidates)).resolves.toEqual(['components/other.vue'])
    const replacement = await source('pages/replacement.vue', code('first'))
    await rename(replacement, page)
    await expect(collectImportedVueComponents(createState([]) as any, candidates)).resolves.toEqual(['components/first.vue'])
  })

  it('observes a directory junction retarget between discovery calls', async () => {
    await source('versions/first/index.vue', '<script setup>import Card from \'../../components/first.vue\'</script>')
    await source('versions/other/index.vue', '<script setup>import Card from \'../../components/other.vue\'</script>')
    await source('components/first.vue', '<template><view /></template>')
    await source('components/other.vue', '<template><view /></template>')
    await mkdir(path.join(root, 'pages'))
    const link = path.join(root, 'pages/current')
    await symlink(path.join(root, 'versions/first'), link, 'junction')
    const candidates = [{ entry: 'pages/current/index.vue', type: 'page' as const }]
    const state = createState([])
    await expect(collectImportedVueComponents(state as any, candidates)).resolves.toEqual(['components/first.vue'])
    await unlink(link)
    await symlink(path.join(root, 'versions/other'), link, 'junction')
    await expect(collectImportedVueComponents(state as any, candidates)).resolves.toEqual(['components/other.vue'])
  })

  it('retains the source root captured at discovery start across multiple batches', async () => {
    const pages = Array.from({ length: 9 }, (_, index) => `pages/page-${index}.vue`)
    for (const page of pages) {
      await source(page, '<script setup>import Card from \'../components/card.vue\'</script>')
    }
    await source('components/card.vue', '<template><view /></template>')
    const state = createState([])
    const rootGetter = vi.fn()
      .mockReturnValueOnce(root)
      .mockReturnValue(path.join(root, 'other'))
    Object.defineProperty(state.ctx.configService, 'absoluteSrcRoot', { get: rootGetter })
    await expect(collectImportedVueComponents(state as any, pages.map(entry => ({ entry, type: 'page' })))).resolves.toEqual(['components/card.vue'])
    expect(rootGetter).toHaveBeenCalledTimes(1)
  })
})
