import { Buffer } from 'node:buffer'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CompilerHmrHost, CompilerHmrResyncError, compilerSourceId, getCompilerRawSnapshot } from '../../plugins/compilerPlugin/hmr'
import { readCompilerRawInput } from '../../plugins/compilerPlugin/rawInputs'
import { createSnapshotAssetInputs } from './snapshotAssetInputs'

let root: string
beforeEach(() => {
  root = realpathSync(mkdtempSync(path.join(tmpdir(), 'snapshot-raw-asset-')))
})
afterEach(() => {
  vi.restoreAllMocks()
  rmSync(root, { recursive: true, force: true })
})

function fixture(ownership: 'raw' | 'dependency' | 'module' = 'raw') {
  const file = path.join(root, 'logo.svg')
  const source = '<svg><path d="M0 0"/></svg>'
  writeFileSync(file, source)
  const host = new CompilerHmrHost()
  if (ownership === 'raw') {
    host.captureRaw(file, source)
  }
  else if (ownership === 'dependency') {
    host.seed(file, source)
  }
  else {
    host.captureNative(file, 'export default "/assets/logo.svg"')
  }
  const input = host.freeze([])
  return { file, source, host, input, admission: createSnapshotAssetInputs(input.sources) }
}

it.each(['raw', 'dependency'] as const)('admits unchanged %s asset bytes through the resolved classifier', (ownership) => {
  const { file, admission } = fixture(ownership)
  admission.configure(id => id === file)
  expect(() => admission.capture(file)).not.toThrow()
  expect(() => admission.validate()).not.toThrow()
})

it('does not classify a loader module as raw after executable native inputs are reset', () => {
  const { file, source, host } = fixture('dependency')
  host.captureNative(file, 'export default "/assets/logo.svg"')
  host.setNativeSources([])
  const input = host.freeze([])
  expect(getCompilerRawSnapshot(input.sources)?.files.has(compilerSourceId(file))).toBe(false)
  writeFileSync(file, `${source}\nfuture`)
  const admission = createSnapshotAssetInputs(input.sources)
  expect(() => admission.configure(() => true)).not.toThrow()
  expect(() => admission.capture(file)).not.toThrow()
  expect(() => admission.validate()).not.toThrow()
})

it('keeps raw ownership on the frozen Map when later capture changes the live module owner', () => {
  const { file, source, host, input, admission } = fixture('dependency')
  host.captureNative(file, 'export default "/assets/logo.svg"')
  host.setNativeSources([])
  writeFileSync(file, `${source}\nfuture`)
  expect(getCompilerRawSnapshot(input.sources)?.files.has(compilerSourceId(file))).toBe(true)
  expect(getCompilerRawSnapshot(host.freeze([]).sources)?.files.has(compilerSourceId(file))).toBe(false)
  expect(() => {
    admission.configure(() => true)
    admission.capture(file)
  }).toThrow(CompilerHmrResyncError)
})

it('does not gain raw ownership when a later raw reader captures an earlier loader module', () => {
  const { file, source, host, input, admission } = fixture('module')
  host.captureRaw(file, source)
  expect(getCompilerRawSnapshot(input.sources)?.files.has(compilerSourceId(file))).toBe(false)
  expect(getCompilerRawSnapshot(host.freeze([]).sources)?.files.has(compilerSourceId(file))).toBe(true)
  expect(() => admission.configure(() => true)).not.toThrow()
  expect(() => admission.capture(file)).not.toThrow()
})

it('does not inspect raw files excluded by the resolved asset classifier', () => {
  const { file, admission } = fixture()
  rmSync(file)
  expect(() => admission.configure(() => false)).not.toThrow()
  expect(() => admission.capture(file)).not.toThrow()
  expect(() => admission.validate()).not.toThrow()
})

it.each(['changed', 'removed', 'replaced-with-same-bytes'] as const)('rejects a raw asset %s during the build before publication', (change) => {
  const { file, source, admission } = fixture()
  admission.configure(() => true)
  admission.capture(file)
  if (change === 'changed') {
    writeFileSync(file, `${source}\nfuture`)
  }
  else if (change === 'removed') {
    unlinkSync(file)
  }
  else {
    const replacement = path.join(root, 'replacement.svg')
    writeFileSync(replacement, source)
    renameSync(replacement, file)
  }
  expect(() => admission.validate()).toThrow(CompilerHmrResyncError)
})

it.each(['missing', 'tombstone'] as const)('rejects a %s raw asset with a canonical resync and concrete file', (state) => {
  const { file, host } = fixture()
  if (state === 'tombstone') {
    host.capture(file, null)
  }
  else {
    rmSync(file)
  }
  const admission = createSnapshotAssetInputs(host.freeze([]).sources)
  let failure: unknown
  try {
    admission.configure(() => true)
    admission.capture(file)
  }
  catch (error) {
    failure = error
  }
  expect(failure).toBeInstanceOf(CompilerHmrResyncError)
  expect((failure as CompilerHmrResyncError).files).toContain(file)
  expect((failure as Error).cause).toBeInstanceOf(Error)
})

it('rejects lossy binary text even when UTF-8 decoding produces the same source string', () => {
  const file = path.join(root, 'binary.asset')
  writeFileSync(file, Buffer.from([255]))
  const host = new CompilerHmrHost()
  host.seed(file, readFileSync(file, 'utf8'))
  writeFileSync(file, Buffer.from([254]))
  const admission = createSnapshotAssetInputs(host.freeze([]).sources)
  expect(() => {
    admission.configure(() => true)
    admission.capture(file)
  }).toThrow(CompilerHmrResyncError)
})

it('uses the actual alias loader id for classification and validates its physical raw source', () => {
  const directory = path.join(root, 'physical')
  mkdirSync(directory)
  const file = path.join(directory, 'logo.asset')
  writeFileSync(file, 'known asset')
  const alias = path.join(root, 'alias')
  symlinkSync(directory, alias, 'junction')
  const aliasFile = path.join(alias, 'logo.asset')
  const host = new CompilerHmrHost()
  host.seed(aliasFile, 'known asset')
  const admission = createSnapshotAssetInputs(host.freeze([]).sources)
  admission.configure(id => id === aliasFile)
  admission.capture(aliasFile)
  writeFileSync(file, 'future asset')
  expect(() => admission.validate()).toThrow(CompilerHmrResyncError)
})

it('preserves other build failures and only unwraps its own sole admission rejection', () => {
  const { file, admission } = fixture()
  writeFileSync(file, 'future asset')
  let failure: unknown
  try {
    admission.configure(() => true)
    admission.capture(file)
  }
  catch (error) {
    failure = error
  }
  const unrelated = new Error('unrelated build failure')
  expect(admission.restoreError({ errors: [failure] })).toBe(failure)
  expect(admission.restoreError(unrelated)).toBe(unrelated)
  const mixed = { errors: [failure, unrelated] }
  expect(admission.restoreError(mixed)).toBe(mixed)
})

it('freezes already canonical raw ownership without repeating filesystem identity probes', () => {
  const { host } = fixture('dependency')
  const identity = vi.spyOn(realpathSync, 'native')
  host.freeze([])
  expect(identity).not.toHaveBeenCalled()
})

it('does not reject an unused tombstone before the actual asset loader consumes it', () => {
  const { file, host } = fixture()
  host.capture(file, null)
  rmSync(file)
  const admission = createSnapshotAssetInputs(host.freeze([]).sources)
  admission.configure(() => true)
  expect(() => admission.validate()).not.toThrow()
  expect(() => admission.capture(file)).toThrow(CompilerHmrResyncError)
})

it('rejects a known physical raw key replaced by a symlink instead of losing its frozen identity', () => {
  const physical = path.join(root, 'physical')
  const replacement = path.join(root, 'replacement')
  mkdirSync(physical)
  mkdirSync(replacement)
  const file = path.join(physical, 'logo.svg')
  writeFileSync(file, 'same bytes')
  writeFileSync(path.join(replacement, 'logo.svg'), 'same bytes')
  const host = new CompilerHmrHost()
  host.seed(file, 'same bytes')
  const admission = createSnapshotAssetInputs(host.freeze([]).sources)
  rmSync(physical, { recursive: true })
  symlinkSync(replacement, physical, 'junction')
  expect(() => {
    admission.configure(() => true)
    admission.capture(file)
  }).toThrow(CompilerHmrResyncError)
})

it('keeps unconsumed canonical string assets lazy after disk drift', () => {
  const { file, admission } = fixture()
  writeFileSync(file, 'future asset')
  expect(() => admission.configure(() => true)).not.toThrow()
  expect(() => admission.validate()).not.toThrow()
  expect(() => admission.capture(file)).toThrow(CompilerHmrResyncError)
})

it('validates alias binding after the build when only its physical target matches assetsInclude', () => {
  const physical = path.join(root, 'physical')
  const replacement = path.join(root, 'replacement')
  mkdirSync(physical)
  mkdirSync(replacement)
  const file = path.join(physical, 'logo.asset')
  writeFileSync(file, 'frozen asset')
  writeFileSync(path.join(replacement, 'logo.asset'), 'future asset')
  const alias = path.join(root, 'alias')
  symlinkSync(physical, alias, 'junction')
  const host = new CompilerHmrHost()
  host.seed(path.join(alias, 'logo.asset'), 'frozen asset')
  const admission = createSnapshotAssetInputs(host.freeze([]).sources)
  admission.configure(id => id === file)
  unlinkSync(alias)
  symlinkSync(replacement, alias, 'junction')
  expect(() => admission.validate()).toThrow(CompilerHmrResyncError)
})

it('pins binary receipts to the frozen Map when different bytes decode to the same text', () => {
  const file = path.join(root, 'binary.asset')
  writeFileSync(file, Buffer.from([255]))
  const host = new CompilerHmrHost()
  const before = readCompilerRawInput(file)!
  host.seed(file, before.source, before)
  const oldInput = host.freeze([])
  writeFileSync(file, Buffer.from([254]))
  const after = readCompilerRawInput(file)!
  expect(after.source).toBe(before.source)
  expect(after.digest).not.toBe(before.digest)
  expect(Object.isFrozen(after)).toBe(true)
  host.captureRaw(file, after.source, false, after)
  const oldAdmission = createSnapshotAssetInputs(oldInput.sources)
  oldAdmission.configure(() => true)
  expect(() => oldAdmission.capture(file)).toThrow(CompilerHmrResyncError)
  const admission = createSnapshotAssetInputs(host.freeze([]).sources)
  admission.configure(() => true)
  expect(() => admission.capture(file)).not.toThrow()
  expect(() => admission.validate()).not.toThrow()
})

it('does not replace the receipt when a repeated seed keeps the earlier saved text', () => {
  const file = path.join(root, 'binary.asset')
  writeFileSync(file, Buffer.from([255]))
  const host = new CompilerHmrHost()
  const before = readCompilerRawInput(file)!
  host.seed(file, before.source, before)
  writeFileSync(file, Buffer.from([254]))
  const after = readCompilerRawInput(file)!
  host.seed(file, after.source, after)
  const input = host.freeze([])
  expect(getCompilerRawSnapshot(input.sources)?.reads.get(compilerSourceId(file))).toBe(before)
  const admission = createSnapshotAssetInputs(input.sources)
  admission.configure(() => true)
  expect(() => admission.capture(file)).toThrow(CompilerHmrResyncError)
})

it('rejects same-byte replacement before prepare when a real read recorded the file version', () => {
  const file = path.join(root, 'binary.asset')
  writeFileSync(file, Buffer.from([255]))
  const host = new CompilerHmrHost()
  const read = readCompilerRawInput(file)!
  host.seed(file, read.source, read)
  const input = host.freeze([])
  const replacement = path.join(root, 'replacement.asset')
  writeFileSync(replacement, Buffer.from([255]))
  renameSync(replacement, file)
  const admission = createSnapshotAssetInputs(input.sources)
  admission.configure(() => true)
  expect(() => admission.capture(file)).toThrow(CompilerHmrResyncError)
})

it.each(['retarget', 'retarget-revert'] as const)('rejects a known text query alias after %s before Vite resolution', (change) => {
  const physical = path.join(root, 'physical')
  const replacement = path.join(root, 'replacement')
  mkdirSync(physical)
  mkdirSync(replacement)
  const file = path.join(physical, 'message.txt')
  writeFileSync(file, 'frozen text')
  writeFileSync(path.join(replacement, 'message.txt'), 'future text')
  const alias = path.join(root, 'alias')
  symlinkSync(physical, alias, 'junction')
  const host = new CompilerHmrHost()
  host.seed(path.join(alias, 'message.txt'), 'frozen text')
  const input = host.freeze([])
  unlinkSync(alias)
  symlinkSync(replacement, alias, 'junction')
  if (change === 'retarget-revert') {
    unlinkSync(alias)
    symlinkSync(physical, alias, 'junction')
  }
  // 文本 query 不依赖扩展名资产分类，仍在 resolve 产出新 physical id 之前拒绝旧绑定。
  expect(() => createSnapshotAssetInputs(input.sources).configure(() => false)).toThrow(CompilerHmrResyncError)
})

it('rejects a canonical text query path replaced by a junction before Vite produces a new physical id', () => {
  const physical = path.join(root, 'physical')
  const replacement = path.join(root, 'replacement')
  mkdirSync(physical)
  mkdirSync(replacement)
  const file = path.join(physical, 'message.txt')
  writeFileSync(file, 'frozen text')
  writeFileSync(path.join(replacement, 'message.txt'), 'future text')
  const host = new CompilerHmrHost()
  host.seed(file, 'frozen text')
  const input = host.freeze([])
  rmSync(physical, { recursive: true })
  symlinkSync(replacement, physical, 'junction')
  expect(() => createSnapshotAssetInputs(input.sources).configure(() => false)).toThrow(CompilerHmrResyncError)
})

it('retains the observed physical path identity after a lexical alias has moved to a newer input', () => {
  const oldPhysical = path.join(root, 'old-physical')
  const newPhysical = path.join(root, 'new-physical')
  const replacement = path.join(root, 'replacement')
  for (const directory of [oldPhysical, newPhysical, replacement]) {
    mkdirSync(directory)
    writeFileSync(path.join(directory, 'message.txt'), path.basename(directory))
  }
  const alias = path.join(root, 'alias')
  symlinkSync(oldPhysical, alias, 'junction')
  const aliasFile = path.join(alias, 'message.txt')
  const host = new CompilerHmrHost()
  host.seed(aliasFile, 'old-physical')
  unlinkSync(alias)
  symlinkSync(newPhysical, alias, 'junction')
  host.captureRaw(aliasFile, 'new-physical', false)
  const input = host.freeze([])
  expect(input.sources.get(path.join(oldPhysical, 'message.txt'))).toBe('old-physical')
  rmSync(oldPhysical, { recursive: true })
  symlinkSync(replacement, oldPhysical, 'junction')
  // 旧 physical 仍可能由另一个入口消费，更新 alias 不能撤销它已观察的路径身份。
  expect(() => createSnapshotAssetInputs(input.sources).configure(() => false)).toThrow(CompilerHmrResyncError)
})
