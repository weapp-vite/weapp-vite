import type { MutableCompilerContext } from '../../context'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtimeState'
import { updateCandidateFromFile } from './watch'

const findVueEntryMock = vi.hoisted(() => vi.fn())
const findJsEntryMock = vi.hoisted(() => vi.fn())
const findTemplateEntryMock = vi.hoisted(() => vi.fn())
const findCssEntryMock = vi.hoisted(() => vi.fn())
const findJsonEntryMock = vi.hoisted(() => vi.fn())

vi.mock('../../utils/file', () => ({
  findVueEntry: findVueEntryMock,
  findJsEntry: findJsEntryMock,
  findTemplateEntry: findTemplateEntryMock,
  findCssEntry: findCssEntryMock,
  findJsonEntry: findJsonEntryMock,
}))

function createContext(): MutableCompilerContext {
  return {
    configService: {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
      weappViteConfig: {
        autoRoutes: true,
      },
    },
    runtimeState: createRuntimeState(),
  } as MutableCompilerContext
}

describe('autoRoutesPlugin watch helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findVueEntryMock.mockResolvedValue(undefined)
    findJsEntryMock.mockResolvedValue({ path: undefined, predictions: [] })
    findTemplateEntryMock.mockResolvedValue({ path: undefined, predictions: [] })
    findCssEntryMock.mockResolvedValue({ path: undefined, predictions: [] })
    findJsonEntryMock.mockResolvedValue({ path: undefined, predictions: [] })
  })

  it('rebuilds candidate entries with concurrent sidecar discovery', async () => {
    const ctx = createContext()
    const candidates = new Map()
    const startedBeforeRelease: string[] = []
    let releaseVue: (() => void) | undefined
    let vueReleased = false

    const trackStart = (name: string) => {
      if (!vueReleased) {
        startedBeforeRelease.push(name)
      }
    }

    findVueEntryMock.mockImplementation(async (base: string) => {
      trackStart('vue')
      await new Promise<void>((resolve) => {
        releaseVue = () => {
          vueReleased = true
          resolve()
        }
      })
      return `${base}.vue`
    })
    findJsEntryMock.mockImplementation(async (base: string) => {
      trackStart('js')
      return { path: `${base}.ts`, predictions: [] }
    })
    findTemplateEntryMock.mockImplementation(async (base: string) => {
      trackStart('template')
      return { path: `${base}.wxml`, predictions: [] }
    })
    findCssEntryMock.mockImplementation(async (base: string) => {
      trackStart('css')
      return { path: `${base}.wxss`, predictions: [] }
    })
    findJsonEntryMock.mockImplementation(async (base: string) => {
      trackStart('json')
      return { path: `${base}.json`, predictions: [] }
    })

    const pending = updateCandidateFromFile(
      ctx,
      candidates,
      '/project/src/pages/home/index.ts',
      'create',
    )

    await vi.waitFor(() => {
      expect(releaseVue).toBeDefined()
      expect(startedBeforeRelease).toEqual(['vue', 'js', 'template', 'css', 'json'])
    })
    releaseVue?.()
    await expect(pending).resolves.toBe(true)

    expect(candidates.get('/project/src/pages/home/index')).toEqual({
      base: '/project/src/pages/home/index',
      files: new Set([
        '/project/src/pages/home/index.vue',
        '/project/src/pages/home/index.ts',
        '/project/src/pages/home/index.wxml',
        '/project/src/pages/home/index.wxss',
        '/project/src/pages/home/index.json',
      ]),
      hasScript: true,
      hasTemplate: true,
      jsonPath: '/project/src/pages/home/index.json',
    })
  })
})
