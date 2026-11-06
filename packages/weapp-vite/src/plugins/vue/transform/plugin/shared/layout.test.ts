import type { CompilerContext } from '../../../../../context'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { expect, it, vi } from 'vitest'
import { withCompilerSourceSnapshot } from '../../../../utils/sourceSnapshot'
import { createPageEntryMatcher } from '../../../../wevu'
import * as pageLayout from '../../pageLayout'
import { preloadNativeLayoutEntries, resolveTransformEntryFlags } from './layout'

it('recognizes independent pages through both a directory junction and its real source path', async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-page-matcher-'))
  try {
    const sourceRoot = path.join(temporaryRoot, 'source')
    const page = path.join(sourceRoot, 'packageB/pages/home/index.vue')
    await fs.mkdir(path.dirname(page), { recursive: true })
    await fs.writeFile(page, '<template><view>page</view></template>')
    const linkedRoot = path.join(temporaryRoot, 'linked-source')
    await fs.symlink(sourceRoot, linkedRoot, 'junction')
    const createMatcher = vi.fn(createPageEntryMatcher)
    const configService = { absoluteSrcRoot: linkedRoot } as CompilerContext['configService']
    const scanService = {
      loadAppEntry: async () => ({ json: { pages: [] } }),
      loadSubPackages: () => [{ subPackage: { root: 'packageB', pages: ['pages/home/index'] } }],
    } as unknown as CompilerContext['scanService']
    const options = {
      pageMatcher: null,
      setPageMatcher: vi.fn(),
      createPageMatcher: createMatcher,
      configService,
      scanService,
      scanDirty: false,
      scanDirtySynced: false,
      setScanDirtySynced: vi.fn(),
      filename: await fs.realpath(page),
    }
    const realPage = await resolveTransformEntryFlags(options)
    expect(realPage.isPage).toBe(true)
    expect(createMatcher).toHaveBeenCalledWith(expect.objectContaining({ srcRoot: path.normalize(await fs.realpath(sourceRoot)) }))
    const linkedPage = await resolveTransformEntryFlags({
      ...options,
      pageMatcher: realPage.pageMatcher,
      filename: path.join(linkedRoot, 'packageB/pages/home/index.vue'),
    })
    expect(linkedPage.isPage).toBe(true)
    expect(createMatcher).toHaveBeenCalledTimes(1)
  }
  finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true })
  }
})

it('preloads page layout metadata from prepared frozen source', async () => {
  const filename = '/project/src/pages/layout.vue'
  const source = `<script setup>
// #ifdef MP-WEIXIN
definePageMeta({ layout: 'active' })
// #endif
// #ifndef MP-WEIXIN
definePageMeta({ layout: 'inactive' })
// #endif
</script><template><view /></template>`
  const configService = {
    platform: 'weapp',
    absoluteSrcRoot: '/project/src',
    weappViteConfig: { uniApp: { include: [] } },
  } as unknown as CompilerContext['configService']
  const readFile = vi.fn(async () => '<script setup>definePageMeta({ layout: "later-disk" })</script>')
  const resolvePlan = vi.spyOn(pageLayout, 'resolvePageLayoutPlan').mockResolvedValue(undefined)
  try {
    await withCompilerSourceSnapshot(configService, new Map([[filename, source]]), async () => {
      await preloadNativeLayoutEntries({
        pluginCtx: {},
        ctx: { configService } as CompilerContext,
        configService,
        scanService: {} as CompilerContext['scanService'],
        collectFallbackPageEntryIds: async () => ['/project/src/pages/layout'],
        findFirstResolvedVueLikeEntry: async () => filename,
        pathExists: async () => true,
        readFile,
      })
    })

    expect(readFile).not.toHaveBeenCalled()
    expect(resolvePlan).toHaveBeenCalledTimes(1)
    expect(resolvePlan.mock.calls[0]?.[0]).toContain('layout: \'active\'')
    expect(resolvePlan.mock.calls[0]?.[0]).not.toContain('inactive')
    expect(resolvePlan.mock.calls[0]?.[0]).not.toContain('later-disk')
  }
  finally {
    resolvePlan.mockRestore()
  }
})
