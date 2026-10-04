import type { MutableCompilerContext } from '../../context'
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
