import type { DevModuleGraphChange } from '../../moduleGraph/devProvider'
import type { HmrProfileProvenance } from '../../utils/hmrProfile/provenance'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDevModuleGraphPlugin } from '../../moduleGraph/devProvider'
import { compilerSourceId } from '../../plugins/compilerPlugin/hmr'
import { compilerNativeScriptVersion, readCompilerInput } from '../../plugins/utils/sourceSnapshot'
import { HmrSourcePublicationOwner } from '../hmrRuntimeSession/sourcePublication'
import { observeClassicSourceChange } from './sourceObservation'
import { beginClassicSourcePublication } from './sourcePublication'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function createFixture() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'source-stable-read-')))
  roots.push(root)
  const file = path.join(root, 'page.ts')
  const sourceId = compilerSourceId(file)
  const outputRoot = path.join(root, 'dist')
  const owner = new HmrSourcePublicationOwner()
  const configService = { cwd: root, outDir: outputRoot, inlineConfig: {} }
  const ctx = { configService, moduleGraphService: {}, runtimeState: {} } as any
  const onChange = vi.fn<(change: DevModuleGraphChange) => void>()
  const plugin = createDevModuleGraphPlugin(ctx, {}, onChange, change => observeClassicSourceChange(owner, outputRoot, change))
  return {
    configService,
    file,
    sourceId,
    outputRoot,
    owner,
    onChange,
    update(read: () => Promise<string>, request = file) {
      return (plugin.hotUpdate as any).call({ environment: { name: 'client' } }, { type: 'update', file: request, read }) as Promise<void>
    },
  }
}

describe('classic source stable read publication', () => {
  it('proves native update and baseline restoration when the restore notification first sees a truncated file', async () => {
    const fixture = await createFixture()
    const baseline = 'Page({ data: { value: "baseline" } })'
    const updated = 'Page({ data: { value: "updated" } })'
    const generations = new Map<string, object>()
    const publish = async (source: string) => {
      const token = fixture.owner.capture(fixture.outputRoot)[0]!
      const profile: HmrProfileProvenance = { sourceEvents: [token.event] }
      const publication = beginClassicSourcePublication({ inputOwner: fixture.configService, sourceOwner: fixture.owner, outputRoot: fixture.outputRoot, outputGenerations: generations, profile: () => profile, buildId: token.event.eventId, batchId: () => 'batch' })
      try {
        await publication.run(async () => {
          expect(await readCompilerInput(fixture.configService, fixture.file)).toBe(source)
          expect(profile.sourceEvents).toEqual([token.event])
          generations.set(fixture.outputRoot, {})
        })
        publication.finish(true)
        expect(fixture.owner.capture(fixture.outputRoot)).toEqual([])
      }
      finally {
        publication.finish(false)
      }
    }
    try {
      for (const source of [baseline, updated]) {
        await writeFile(fixture.file, source)
        await fixture.update(async () => source)
        await publish(source)
      }
      await writeFile(fixture.file, '')
      const stableRead = Promise.withResolvers<string>()
      const restoring = fixture.update(() => stableRead.promise)
      const transient = fixture.owner.capture(fixture.outputRoot)[0]!
      expect(transient.version).toBe(compilerNativeScriptVersion(''))
      await writeFile(fixture.file, baseline)
      stableRead.resolve(baseline)
      await restoring
      const settled = fixture.owner.capture(fixture.outputRoot)[0]!
      expect(settled.version).toBe(compilerNativeScriptVersion(baseline))
      expect(settled.event).toEqual(transient.event)
      expect(fixture.onChange.mock.calls.at(-1)?.[0]).toEqual({ event: 'update', file: fixture.file, sourceEvent: settled.event })
      await publish(baseline)
    }
    finally {
      fixture.owner.close()
    }
  })

  it('does not let an older stable read replace the newer observed save', async () => {
    const fixture = await createFixture()
    const a = Promise.withResolvers<string>()
    try {
      await writeFile(fixture.file, 'A')
      const updatingA = fixture.update(() => a.promise)
      await writeFile(fixture.file, 'B')
      await fixture.update(async () => 'B')
      const pendingB = fixture.owner.capture(fixture.outputRoot)
      a.resolve('A')
      await updatingA
      expect(fixture.owner.capture(fixture.outputRoot)).toEqual(pendingB)
      expect(pendingB[0]?.version).toBe(compilerNativeScriptVersion('B'))
    }
    finally {
      a.resolve('A')
      fixture.owner.close()
    }
  })

  it.each(['delete', 'close'] as const)('does not revive a pending source after %s while its stable read is pending', async (action) => {
    const fixture = await createFixture()
    const stableRead = Promise.withResolvers<string>()
    try {
      await writeFile(fixture.file, 'A')
      const updating = fixture.update(() => stableRead.promise)
      if (action === 'delete') {
        fixture.owner.invalidate(fixture.outputRoot, fixture.sourceId)
      }
      else {
        fixture.owner.close()
      }
      stableRead.resolve('B')
      await updating
      expect(fixture.owner.capture(fixture.outputRoot)).toEqual([])
    }
    finally {
      stableRead.resolve('A')
      fixture.owner.close()
    }
  })

  it('can observe the stable changed input when the first read still matches the published baseline', async () => {
    const fixture = await createFixture()
    try {
      await writeFile(fixture.file, 'BASE')
      const published = fixture.owner.begin(fixture.outputRoot)
      published.recordInput(fixture.sourceId, compilerNativeScriptVersion('BASE'))
      published.markCommitted()
      published.finish(true)
      const stableRead = Promise.withResolvers<string>()
      const updating = fixture.update(() => stableRead.promise)
      expect(fixture.owner.capture(fixture.outputRoot)).toEqual([])
      await writeFile(fixture.file, 'NEXT')
      stableRead.resolve('NEXT')
      await updating
      expect(fixture.owner.capture(fixture.outputRoot)[0]?.version).toBe(compilerNativeScriptVersion('NEXT'))
    }
    finally {
      fixture.owner.close()
    }
  })

  it('does not assign a stable alias read to the physical file observed before its target changed', async () => {
    const fixture = await createFixture()
    const stableRead = Promise.withResolvers<string>()
    const root = path.dirname(fixture.file)
    const alias = path.join(root, 'alias')
    const replacement = path.join(root, 'replacement')
    try {
      await writeFile(fixture.file, 'A')
      await mkdir(replacement)
      await writeFile(path.join(replacement, 'page.ts'), 'B')
      await symlink(root, alias, 'junction')
      const updating = fixture.update(() => stableRead.promise, path.join(alias, 'page.ts'))
      const pendingA = fixture.owner.capture(fixture.outputRoot)
      await rm(alias)
      await symlink(replacement, alias, 'junction')
      stableRead.resolve('B')
      await updating
      expect(fixture.owner.capture(fixture.outputRoot)).toEqual(pendingA)
      const build = fixture.owner.begin(fixture.outputRoot)
      build.recordInput(compilerSourceId(path.join(alias, 'page.ts')), compilerNativeScriptVersion('B'))
      expect(build.sourceEvents).toEqual([])
      build.finish(false)
    }
    finally {
      stableRead.resolve('A')
      fixture.owner.close()
    }
  })
})
