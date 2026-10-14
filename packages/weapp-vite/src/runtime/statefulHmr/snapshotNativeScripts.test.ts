import type { MutableCompilerContext } from '../../context'
import { createHash } from 'node:crypto'
import { mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { compilerSourceId, getCompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { readCompilerRawInput } from '../../plugins/compilerPlugin/rawInputs'
import { createSnapshotNativeScriptDriftProbe } from './snapshotNativeScripts'

const roots: string[] = []
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })))
const version = (source: string) => createHash('sha256').update(source).digest('hex')

function setup(raw = true) {
  const root = mkdtempSync(path.join(tmpdir(), 'native-script-drift-'))
  roots.push(root)
  const file = path.join(root, 'page.js')
  const source = 'Page({ data: { marker: "before" } })'
  writeFileSync(file, source)
  const ctx = { configService: {}, runtimeState: {} } as unknown as MutableCompilerContext
  const host = getCompilerHmrHost(ctx)
  const read = readCompilerRawInput(file)!
  if (raw) {
    host.captureRaw(file, source, true, read)
  }
  else {
    host.captureNative(file, 'loader-transformed-output')
  }
  const id = compilerSourceId(file)
  const versions = new Map([[id, version(source)]])
  const probe = createSnapshotNativeScriptDriftProbe(host.freeze([]).sources, versions)
  return { file, id, source, versions, probe, host }
}

it('observes raw late saves at the commit boundary without changing consumed versions or the live ledger', () => {
  const input = setup()
  expect(input.probe().size).toBe(0)
  const current = input.source.replace('before', 'after')
  writeFileSync(`${input.file}.tmp`, current)
  renameSync(`${input.file}.tmp`, input.file)
  expect(input.probe()).toEqual(new Map([[input.id, version(current)]]))
  expect(input.versions.get(input.id)).toBe(version(input.source))
  expect(input.host.readSource(input.file)).toBe(input.source)
  writeFileSync(input.file, input.source)
  expect(input.probe().size).toBe(0)
})

it('retains missing input observations and checks a recreated source', () => {
  const input = setup()
  rmSync(input.file)
  expect(input.probe()).toEqual(new Map([[input.id, null]]))
  writeFileSync(input.file, 'Page({})')
  expect(input.probe()).toEqual(new Map([[input.id, version('Page({})')]]))
})

it('leaves module loader provenance to its owner', () => {
  const input = setup(false)
  writeFileSync(input.file, 'future disk content')
  expect(input.probe().size).toBe(0)
  expect(input.host.readSource(input.file)).toBe('loader-transformed-output')
})
