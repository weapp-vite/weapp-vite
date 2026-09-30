import type { MutableCompilerContext } from '../../context'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { extractConfigFromVue } from './vueConfig'

it('evaluates and caches one Vue macro independently in two concurrent compiler sessions', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vue-config-sessions-'))
  try {
    const file = path.join(root, 'app.vue')
    await fs.writeFile(file, `<script setup lang="ts">
import routes from 'virtual:weapp-vite-auto-routes'
defineAppJson({ pages: routes.pages })
</script>`)
    const context = (name: string) => ({
      autoRoutesService: {
        ensureFresh: async () => {},
        getReference: () => ({ pages: [name], entries: [], subPackages: [] }),
      },
      runtimeState: { autoRoutes: { loadingAppConfig: false } },
    }) as unknown as MutableCompilerContext
    const first = context('pages/first/index')
    const second = context('pages/second/index')
    const results = await Promise.all([
      extractConfigFromVue(file, { compilerContext: first }),
      extractConfigFromVue(file, { compilerContext: second }),
    ])
    expect(results).toEqual([
      { pages: ['pages/first/index'] },
      { pages: ['pages/second/index'] },
    ])
    expect(await extractConfigFromVue(file, { compilerContext: first })).toEqual(results[0])
    expect(await extractConfigFromVue(file, { compilerContext: second })).toEqual(results[1])
    first.autoRoutesService!.getReference = () => ({ pages: ['pages/replaced/index'], entries: [], subPackages: [] })
    expect(await extractConfigFromVue(file, { compilerContext: first })).toEqual({ pages: ['pages/replaced/index'] })
    expect(await extractConfigFromVue(file, { compilerContext: second })).toEqual(results[1])
  }
  finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
