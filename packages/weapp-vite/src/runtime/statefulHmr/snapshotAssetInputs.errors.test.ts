import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { CompilerHmrHost, CompilerHmrResyncError } from '../../plugins/compilerPlugin/hmr'
import { createSnapshotAssetInputs } from './snapshotAssetInputs'

let root: string
beforeEach(() => {
  root = realpathSync(mkdtempSync(path.join(tmpdir(), 'snapshot-admission-errors-')))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function rejectedInputs() {
  const files = ['first.txt', 'second.txt'].map(filename => path.join(root, filename))
  const changed = path.join(root, 'changed.js')
  const host = new CompilerHmrHost()
  for (const file of files) {
    writeFileSync(file, 'FROZEN')
    host.seed(file, 'FROZEN')
  }
  const admission = createSnapshotAssetInputs(host.freeze([changed]).sources)
  admission.configure(() => false)
  const failures = files.map((file) => {
    writeFileSync(file, 'FUTURE')
    try {
      admission.capture(file, true)
    }
    catch (error) {
      expect(error).toBeInstanceOf(CompilerHmrResyncError)
      return error as CompilerHmrResyncError
    }
    throw new Error('Expected frozen input admission to fail')
  })
  return { admission, failures, files, changed }
}

it('restores every exact own rejection after later hooks have also rejected', () => {
  const { admission, failures } = rejectedInputs()
  for (const failure of failures) {
    expect(admission.restoreError({ errors: [failure] })).toBe(failure)
  }
})

it('restores multiple own rejections with every resync file and the original cause chain', () => {
  const { admission, failures, files, changed } = rejectedInputs()
  const wrapped = new AggregateError(failures, 'Rolldown build failed')
  const restored = admission.restoreError(wrapped)
  expect(restored).toBeInstanceOf(CompilerHmrResyncError)
  expect((restored as CompilerHmrResyncError).files).toEqual([changed, ...files])
  expect((restored as Error).cause).toBe(wrapped)
  for (const failure of failures) {
    expect(failure.cause).toBeInstanceOf(CompilerHmrResyncError)
  }
})

it('preserves a mixed build failure when one rejection belongs to another owner', () => {
  const { admission, failures } = rejectedInputs()
  const { failures: foreign } = rejectedInputs()
  for (const other of [new Error('compiler failure'), foreign[0], new CompilerHmrResyncError(failures[0]!.files, failures[0]!.message)]) {
    const wrapped = new AggregateError([...failures, other], 'Mixed build failure')
    expect(admission.restoreError(wrapped)).toBe(wrapped)
  }
})

it('does not reinterpret empty wrappers or unowned errors', () => {
  const { admission } = rejectedInputs()
  for (const error of [new AggregateError([], 'No admission errors'), new Error('compiler failure'), null, undefined]) {
    expect(admission.restoreError(error)).toBe(error)
  }
})
