import type { MutableCompilerContext } from '../../context'
import { createHash } from 'node:crypto'
import path from 'pathe'
import { expect, it } from 'vitest'
import { getCompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { readCompilerInput } from '../../plugins/utils/sourceSnapshot'
import { NativeScriptInputs } from './nativeScriptInputs'

it('records actual native entry input without registering a compiler provider', async () => {
  const ctx = { configService: {}, runtimeState: {} } as unknown as MutableCompilerContext
  const host = getCompilerHmrHost(ctx)
  host.onDependencyChange = () => {}
  const script = path.resolve('native-entry.js')
  expect(host.enabled).toBe(false)
  await readCompilerInput(ctx.configService, script, async () => 'Page({ data: { value: 1 } })')
  const inputs = new NativeScriptInputs()
  const publication = inputs.capture([script], file => host.readSource(file))
  await readCompilerInput(ctx.configService, script, async () => 'Page({ data: { value: 2 } })')
  inputs.commit(publication)
  expect(inputs.matches(script, host.freeze([script]).sources)).toBe(false)
  await readCompilerInput(ctx.configService, script, async () => 'Page({ data: { value: 1 } })')
  expect(inputs.matches(script, host.freeze([script]).sources)).toBe(true)
})

it('requires a known persisted input and invalidates it after an uncertain publication', () => {
  const script = path.resolve('native-entry.js')
  const inputs = new NativeScriptInputs()
  const known = inputs.capture([script], () => 'Page({})')
  inputs.commit(known)
  expect(inputs.matches(script, inputs.capture([script], () => undefined))).toBe(false)
  expect(inputs.matches(script, inputs.capture([script], () => null))).toBe(false)
  inputs.clear()
  expect(inputs.matches(script, known)).toBe(false)
})

it('tracks committed asset input versions against actual persisted native sources', () => {
  const script = path.resolve('native-entry.js')
  const version = (source: string) => createHash('sha256').update(source).digest('hex')
  const inputs = new NativeScriptInputs()
  inputs.commit(inputs.capture([script], () => 'before'))
  inputs.adoptAssets(new Map([[script, version('before')]]))
  expect(inputs.needsFullBuild(script)).toBe(false)
  inputs.adoptAssets(new Map([[script, version('after')]]))
  expect(inputs.needsFullBuild(script)).toBe(true)
  // 失败的完整写出只撤销原生基线，不能把已落盘资源的输入事实视为已消费。
  inputs.invalidate()
  expect(inputs.needsFullBuild(script)).toBe(true)
  inputs.commit(inputs.capture([script], () => 'before'))
  expect(inputs.needsFullBuild(script)).toBe(true)
  inputs.commit(inputs.capture([script], () => 'after'))
  expect(inputs.needsFullBuild(script)).toBe(false)
  inputs.clear()
  expect(inputs.needsFullBuild(script)).toBe(false)
})

it('retains raw overlap debt across ordinary refreshes and consumes only the completed full generation', () => {
  const script = path.resolve('native-entry.js')
  const version = (source: string) => createHash('sha256').update(source).digest('hex')
  const inputs = new NativeScriptInputs()
  inputs.commit(inputs.capture([script], () => 'before'))
  inputs.adoptAssets(new Map([[script, version('before')]]), new Map([[script, version('after')]]))
  expect(inputs.needsFullBuild(script)).toBe(true)
  const debt = inputs.captureAssetDrift()
  inputs.adoptAssets(new Map([[script, version('before')]]))
  inputs.commit(inputs.capture([script], () => 'after'))
  expect(inputs.needsFullBuild(script)).toBe(true)
  inputs.adoptAssets(new Map([[script, version('after')]]), new Map([[script, version('newer')]]))
  inputs.commitAssetDrift(debt)
  expect(inputs.needsFullBuild(script)).toBe(true)
  const newer = inputs.captureAssetDrift()
  inputs.adoptAssets(new Map([[script, version('newer')]]))
  inputs.commit(inputs.capture([script], () => 'newer'))
  inputs.commitAssetDrift(newer)
  expect(inputs.needsFullBuild(script)).toBe(false)
  inputs.clear()
  expect(inputs.captureAssetDrift().size).toBe(0)
})

it('does not consume drift on restoration, noop, or uncertain native publication', () => {
  const script = path.resolve('native-entry.js')
  const version = createHash('sha256').update('before').digest('hex')
  const inputs = new NativeScriptInputs()
  inputs.commit(inputs.capture([script], () => 'before'))
  inputs.adoptAssets(new Map([[script, version]]), new Map([[script, 'changed-version']]))
  expect(inputs.matches(script, inputs.capture([script], () => 'before'))).toBe(true)
  inputs.invalidate()
  expect(inputs.needsFullBuild(script)).toBe(true)
  inputs.adoptAssets(new Map([[script, version]]))
  expect(inputs.needsFullBuild(script)).toBe(true)
})
