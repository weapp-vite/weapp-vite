import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractConfigFromVue } from './vueConfig'

const mocks = vi.hoisted(() => ({
  getContext: vi.fn(),
  extractMacro: vi.fn(),
  ensureFresh: vi.fn(),
}))

vi.mock('../../context/getInstance', () => ({ getCompilerContext: mocks.getContext }))
vi.mock('wevu/compiler', () => ({ extractJsonMacroFromScriptSetup: mocks.extractMacro }))

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
  vi.resetAllMocks()
})

async function extract(source: string) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vue-config-routes-'))
  roots.push(root)
  const file = path.join(root, 'page.vue')
  await fs.writeFile(file, source)
  mocks.extractMacro.mockResolvedValue({ config: { navigationBarTitleText: '清单' }, dependencies: [] })
  return extractConfigFromVue(file, { source })
}

describe('JSON macro route snapshot ownership', () => {
  it('extracts an ordinary page macro without reading the global compiler context', async () => {
    mocks.getContext.mockImplementation(() => {
      throw new Error('unrelated compiler context')
    })
    const setup = 'definePageJson({ navigationBarTitleText: \'清单\' })'
    expect(await extract(`<script lang="ts">const title = '清单'</script><script setup lang="ts">${setup}</script>`))
      .toEqual({ navigationBarTitleText: '清单' })
    expect(mocks.getContext).not.toHaveBeenCalled()
    expect(mocks.extractMacro).toHaveBeenCalledWith(setup, expect.any(String), 'ts', { preambleContent: 'const title = \'清单\'' })
  })

  it.each(['setup', 'preamble'] as const)('keeps route imports in the %s synchronized before macro evaluation', async (location) => {
    mocks.getContext.mockReturnValue({
      autoRoutesService: {
        ensureFresh: mocks.ensureFresh,
        getReference: () => ({ pages: ['pages/home/index'], entries: [], subPackages: [] }),
      },
      runtimeState: { autoRoutes: { loadingAppConfig: false } },
    })
    const routeImport = 'import routes from \'virtual:weapp-vite-auto-routes\''
    const macro = 'defineAppJson({ pages: routes.pages })'
    await extract(location === 'setup'
      ? `<script setup lang="ts">${routeImport}\n${macro}</script>`
      : `<script lang="ts">${routeImport}</script><script setup lang="ts">${macro}</script>`)
    expect(mocks.ensureFresh).toHaveBeenCalledOnce()
    const call = mocks.extractMacro.mock.calls[0]!
    const inlined = location === 'setup' ? call[0] : call[3].preambleContent
    expect(inlined).toContain('pages/home/index')
    expect(inlined).not.toContain(routeImport)
  })
})
