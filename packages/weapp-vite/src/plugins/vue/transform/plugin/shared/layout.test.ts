import type { CompilerContext } from '../../../../../context'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { expect, it, vi } from 'vitest'
import { createPageEntryMatcher } from '../../../../wevu'
import { resolveTransformEntryFlags } from './layout'

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
