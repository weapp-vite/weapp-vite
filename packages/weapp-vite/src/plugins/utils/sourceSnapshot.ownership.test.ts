import type { CompilerContext } from '../../context'
import { mkdir, mkdtemp, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { CompilerHmrResyncError, compilerSourceId, getCompilerHmrHost } from '../compilerPlugin/hmr'
import { observeCompilerInputs, readCompilerInput, setCompilerSourceSnapshot } from './sourceSnapshot'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'compiler-input-owner-')))
  roots.push(root)
  const file = path.join(root, 'input.json')
  await writeFile(file, 'before')
  const ctx = { configService: {} } as CompilerContext
  const host = getCompilerHmrHost(ctx)
  host.onDependencyChange = vi.fn()
  host.captureRaw(file, 'before')
  const pending = Promise.withResolvers<string>()
  const start = () => readCompilerInput(ctx.configService, file, () => pending.promise)
  return { root, file, ctx, host, pending, start }
}

it('rejects a late old read without rolling back newer raw input or notifying compiler observers', async () => {
  const { ctx, file, host, pending, start } = await fixture()
  const observer = vi.fn()
  const close = observeCompilerInputs(ctx.configService, observer)
  try {
    const reading = start()
    host.captureRaw(file, 'after', false)
    pending.resolve('before')
    await expect(reading).rejects.toBeInstanceOf(CompilerHmrResyncError)
    expect(host.readSource(file)).toBe('after')
    expect(observer).not.toHaveBeenCalled()
  }
  finally {
    close()
  }
})

it('accepts a concurrent capture of the exact returned bytes', async () => {
  const { file, host, pending, start } = await fixture()
  const reading = start()
  host.captureRaw(file, 'after', false)
  pending.resolve('after')
  await expect(reading).resolves.toBe('after')
  expect(host.readSource(file)).toBe('after')
})

it('does not infer a conflict from same-value ABA captures', async () => {
  const { file, host, pending, start } = await fixture()
  const reading = start()
  host.captureRaw(file, 'intermediate', false)
  host.captureRaw(file, 'before', false)
  pending.resolve('before')
  await expect(reading).resolves.toBe('before')
  expect(host.readSource(file)).toBe('before')
})

it('rejects a late read of the intermediate ABA value even after the ledger returns to its initial bytes', async () => {
  const { file, host, pending, start } = await fixture()
  const reading = start()
  host.captureRaw(file, 'intermediate', false)
  host.captureRaw(file, 'before', false)
  pending.resolve('intermediate')
  await expect(reading).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect(host.readSource(file)).toBe('before')
})

it('does not reject a new read just because another source changed in the same host', async () => {
  const { root, file, host, pending, start } = await fixture()
  const reading = start()
  host.captureRaw(path.join(root, 'another.json'), 'unrelated', false)
  pending.resolve('after')
  await expect(reading).resolves.toBe('after')
  expect(host.readSource(file)).toBe('after')
})

it.each(['retired', 'replaced'] as const)('rejects a read after its session callback is %s', async (state) => {
  const { file, host, pending, start } = await fixture()
  const reading = start()
  host.onDependencyChange = state === 'retired' ? undefined : vi.fn()
  host.captureRaw(file, 'replacement', false)
  pending.resolve('before')
  await expect(reading).rejects.toMatchObject({ name: 'CompilerHmrResyncError', files: [file] })
  expect(host.readSource(file)).toBe('replacement')
})

it('never captures an old host read into a replacement host registered for the same config', async () => {
  const { ctx, file, host, pending, start } = await fixture()
  const reading = start()
  const replacement = getCompilerHmrHost({ configService: ctx.configService } as CompilerContext)
  replacement.onDependencyChange = vi.fn()
  replacement.captureRaw(file, 'replacement', false)
  pending.resolve('before')
  await expect(reading).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect(host.readSource(file)).toBe('before')
  expect(replacement.readSource(file)).toBe('replacement')
})

it('rejects an unowned read if a stateful session starts before it completes', async () => {
  const { file, host, pending, start } = await fixture()
  host.onDependencyChange = undefined
  const reading = start()
  host.onDependencyChange = vi.fn()
  host.captureRaw(file, 'active-session', false)
  pending.resolve('before')
  await expect(reading).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect(host.readSource(file)).toBe('active-session')
})

it('keeps an inactive host ledger untouched for reads outside a stateful session', async () => {
  const { file, host, pending, start } = await fixture()
  host.onDependencyChange = undefined
  const reading = start()
  pending.resolve('outside-session')
  await expect(reading).resolves.toBe('outside-session')
  expect(host.readSource(file)).toBe('before')
})

it('rejects a raw alias retargeted during the read and preserves both physical ledgers', async () => {
  const { root, ctx, host, pending } = await fixture()
  const original = path.join(root, 'original')
  const replacement = path.join(root, 'replacement')
  const alias = path.join(root, 'alias')
  await mkdir(original)
  await mkdir(replacement)
  await writeFile(path.join(original, 'input.json'), 'before')
  await writeFile(path.join(replacement, 'input.json'), 'replacement')
  await symlink(original, alias, 'junction')
  const file = path.join(alias, 'input.json')
  const previousId = compilerSourceId(file)
  host.captureRaw(file, 'before')
  const reading = readCompilerInput(ctx.configService, file, () => pending.promise)
  await unlink(alias)
  await symlink(replacement, alias, 'junction')
  host.captureRaw(file, 'replacement', false)
  pending.resolve('before')
  await expect(reading).rejects.toBeInstanceOf(CompilerHmrResyncError)
  expect(host.readSource(previousId)).toBe('before')
  expect(host.readSource(file)).toBe('replacement')
})

it('keeps the original read failure even when the active owner changes', async () => {
  const { host, pending, start } = await fixture()
  const failure = Object.assign(new Error('source denied'), { code: 'EPERM' })
  const reading = start()
  host.onDependencyChange = vi.fn()
  pending.reject(failure)
  await expect(reading).rejects.toBe(failure)
})

it('uses pinned bytes without reading or changing the live input ledger', async () => {
  const { ctx, file, host } = await fixture()
  setCompilerSourceSnapshot(ctx.configService, new Map([[compilerSourceId(file), 'pinned']]))
  const read = vi.fn(async () => 'disk')
  await expect(readCompilerInput(ctx.configService, file, read)).resolves.toBe('pinned')
  expect(read).not.toHaveBeenCalled()
  expect(host.readSource(file)).toBe('before')
})

it('does not treat a different project session update as an ownership change', async () => {
  const first = await fixture()
  const second = await fixture()
  const reading = first.start()
  second.host.captureRaw(second.file, 'second-project', false)
  first.pending.resolve('first-project')
  await expect(reading).resolves.toBe('first-project')
  expect(first.host.readSource(first.file)).toBe('first-project')
  expect(second.host.readSource(second.file)).toBe('second-project')
})
