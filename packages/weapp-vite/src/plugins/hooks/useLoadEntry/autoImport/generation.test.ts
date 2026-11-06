import type { CompilerContext } from '../../../../context'
import type { LocalAutoImportMatch } from '../../../../runtime/autoImport/types'
import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAutoImportAugmenter } from '../autoImport'

const fixtures: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(fixtures.splice(0).map(root => fs.remove(root)))
})

async function createFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-import-generation-'))
  fixtures.push(root)
  const component = path.join(root, 'components/view.vue')
  let version = 0
  let match: LocalAutoImportMatch | undefined
  const registerPotentialComponent = vi.fn(async (file: string) => {
    match = {
      kind: 'local',
      entry: {} as LocalAutoImportMatch['entry'],
      value: { name: 'view', from: '/components/view', resolvedId: file },
    }
    version += 1
  })
  const candidates = { view: [] }
  const augmenter = createAutoImportAugmenter(
    {
      resolve: () => match,
      getVersion: () => version,
      registerPotentialComponent,
    } as unknown as CompilerContext['autoImportService'],
    { getAggregatedAutoImportComponents: () => candidates } as unknown as CompilerContext['wxmlService'],
    undefined,
    {
      absoluteSrcRoot: root,
      weappViteConfig: { autoImportComponents: { globs: ['components/**/*.vue'] } },
    } as CompilerContext['configService'],
  )
  return {
    component,
    importer: path.join(root, 'pages/home/index'),
    augmenter,
    registerPotentialComponent,
    advanceRegistry() { version += 1 },
    removeComponent() {
      match = undefined
      version += 1
    },
  }
}

describe('auto import generation invalidation', () => {
  it('rechecks an unchanged importer after builtin-name component creation, deletion and restoration', async () => {
    const fixture = await createFixture()
    await expect(fixture.augmenter(fixture.importer, {})).resolves.toEqual([])
    await fs.outputFile(fixture.component, '<template><text>local view</text></template>')
    fixture.augmenter.invalidateLocalCandidates()
    const created: Record<string, unknown> = {}
    await expect(fixture.augmenter(fixture.importer, created)).resolves.toEqual([{
      kind: 'local',
      from: '/components/view',
      resolvedId: fixture.component,
    }])
    expect(created.usingComponents).toEqual({ view: '/components/view' })

    await fs.remove(fixture.component)
    fixture.removeComponent()
    fixture.augmenter.invalidateLocalCandidates()
    const deleted: Record<string, unknown> = {}
    await expect(fixture.augmenter(fixture.importer, deleted)).resolves.toEqual([])
    expect(deleted.usingComponents).toBeUndefined()

    await fs.outputFile(fixture.component, '<template><text>restored</text></template>')
    fixture.augmenter.invalidateLocalCandidates()
    const restored: Record<string, unknown> = {}
    await fixture.augmenter(fixture.importer, restored)
    expect(restored.usingComponents).toEqual({ view: '/components/view' })
    expect(fixture.registerPotentialComponent).toHaveBeenCalledTimes(2)
  })

  it('does not hide a candidate that becomes available after a registry update', async () => {
    const fixture = await createFixture()
    await expect(fixture.augmenter(fixture.importer, {})).resolves.toEqual([])
    await fs.outputFile(fixture.component, '<template><text>available</text></template>')
    fixture.advanceRegistry()
    const json: Record<string, unknown> = {}
    await fixture.augmenter(fixture.importer, json)
    expect(json.usingComponents).toEqual({ view: '/components/view' })
  })

  it('allows the same importer to retry when candidate registration fails', async () => {
    const fixture = await createFixture()
    await fs.outputFile(fixture.component, '<template><text>retry</text></template>')
    fixture.registerPotentialComponent.mockRejectedValueOnce(new Error('registration failed'))
    await expect(fixture.augmenter(fixture.importer, {})).rejects.toThrow('registration failed')
    const json: Record<string, unknown> = {}
    await fixture.augmenter(fixture.importer, json)
    expect(json.usingComponents).toEqual({ view: '/components/view' })
    expect(fixture.registerPotentialComponent).toHaveBeenCalledTimes(2)
  })

  it('does not let an old asynchronous lookup replace the next generation resolver result', async () => {
    const fixture = await createFixture()
    let from = '/components/previous'
    let finishOldProbe!: (exists: boolean) => void
    const pending = new Promise<boolean>((resolve) => {
      finishOldProbe = resolve
    })
    const probe = vi.spyOn(fs, 'pathExists').mockImplementationOnce(() => pending)
    const candidates = { Card: [], view: [] }
    const augmenter = createAutoImportAugmenter(
      {
        resolve: (name: string) => name === 'Card'
          ? { kind: 'resolver', value: { name, from } }
          : undefined,
        getVersion: () => 0,
        registerPotentialComponent: async () => {},
      } as unknown as CompilerContext['autoImportService'],
      { getAggregatedAutoImportComponents: () => candidates } as unknown as CompilerContext['wxmlService'],
      undefined,
      {
        absoluteSrcRoot: path.dirname(path.dirname(fixture.component)),
        weappViteConfig: { autoImportComponents: { globs: ['components/**/*.vue'] } },
      } as CompilerContext['configService'],
    )
    const previous = augmenter(fixture.importer, {})
    await vi.waitFor(() => expect(probe).toHaveBeenCalled())
    augmenter.invalidateLocalCandidates()
    from = '/components/current'
    await augmenter(fixture.importer, {})
    finishOldProbe(false)
    await previous
    const json: Record<string, unknown> = {}
    await augmenter(fixture.importer, json)
    expect(json.usingComponents).toEqual({ Card: '/components/current' })
  })
})
