import type { HmrProfileProvenance } from '../../utils/hmrProfile/provenance'
import { mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { CompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { observeBundlerScriptInput } from '../../plugins/utils/bundlerSourceInput'
import { compilerNativeScriptVersion, setCompilerSourceSnapshot } from '../../plugins/utils/sourceSnapshot'
import { HmrSourcePublicationOwner } from '../hmrRuntimeSession/sourcePublication'
import { beginClassicSourcePublication } from './sourcePublication'

const roots: string[] = []

afterEach(() => {
  vi.restoreAllMocks()
  roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true }))
})

it('keeps the frozen input identity when its former physical parent is replaced by an alias', async () => {
  const root = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'publication-input-path-')))
  roots.push(root)
  const first = path.join(root, 'first')
  const second = path.join(root, 'second')
  for (const directory of [first, second]) {
    mkdirSync(directory)
    writeFileSync(path.join(directory, 'source.ts'), 'disk input')
  }
  const alias = path.join(root, 'alias')
  symlinkSync(first, alias, 'junction')
  const request = path.join(alias, 'source.ts')
  const physical = path.join(first, 'source.ts').replaceAll('\\', '/')
  const source = 'frozen input'
  const host = new CompilerHmrHost()
  host.captureRaw(request, source)
  const inputOwner = {}
  setCompilerSourceSnapshot(inputOwner, host.freeze([request]).sources)
  renameSync(first, path.join(root, 'retired'))
  symlinkSync(second, first, 'junction')
  const sourceOwner = new HmrSourcePublicationOwner()
  const outputRoot = path.join(root, 'dist')
  const token = sourceOwner.observe({ root: outputRoot, file: physical, version: compilerNativeScriptVersion(source), eventId: 'frozen-source', event: 'update', receivedAtMs: 1 })!
  const generations = new Map<string, object>()
  const profile: HmrProfileProvenance = {}
  const publication = beginClassicSourcePublication({ inputOwner, sourceOwner, outputRoot, outputGenerations: generations, profile: () => profile, buildId: 'build', batchId: () => 'batch' })
  const native = vi.spyOn(realpathSync, 'native')
  try {
    await publication.run(async () => {
      observeBundlerScriptInput({ configService: inputOwner }, source, request)
      expect(profile.sourceEvents).toEqual([token.event])
      generations.set(outputRoot, {})
    })
    publication.finish(true)

    expect(sourceOwner.capture(outputRoot)).toEqual([])
    expect(native).not.toHaveBeenCalled()
    observeBundlerScriptInput({ configService: inputOwner }, 'after release', request)
    expect(native).not.toHaveBeenCalled()
    expect(profile.sourceEvents).toEqual([token.event])
  }
  finally {
    publication.finish(false)
    sourceOwner.close()
  }
})
