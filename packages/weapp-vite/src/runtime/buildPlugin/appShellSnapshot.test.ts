import type { MutableCompilerContext } from '../../context'
import { expect, it } from 'vitest'
import { createRuntimeState } from '../runtimeState'
import { captureAppShellSnapshot } from './appShellSnapshot'

it('freezes App shell presence independently of later failed transform metadata', async () => {
  const runtimeState = createRuntimeState()
  const appId = 'src/app.vue'
  const ctx = { runtimeState, scanService: { appEntry: { path: appId } } } as unknown as MutableCompilerContext
  expect(await captureAppShellSnapshot(ctx)).toBeUndefined()
  runtimeState.build.hmr.vueEntryHasTemplate.set(appId, false)
  const committed = await captureAppShellSnapshot(ctx)
  runtimeState.build.hmr.vueEntryHasTemplate.set(appId, true)
  expect(committed).toEqual({ appId, hasTemplate: false })
  expect(await captureAppShellSnapshot(ctx)).toEqual({ appId, hasTemplate: true })
})

it('does not assign an App shell generation to library or non-SFC app entries', async () => {
  const runtimeState = createRuntimeState()
  runtimeState.build.hmr.vueEntryHasTemplate.set('src/app.ts', true)
  runtimeState.build.hmr.vueEntryHasTemplate.set('src/app.vue', true)
  const ctx = { runtimeState, scanService: { appEntry: { path: 'src/app.ts' } } } as unknown as MutableCompilerContext
  expect(await captureAppShellSnapshot(ctx)).toBeUndefined()
  ctx.scanService!.appEntry = { path: 'src/app.vue' } as NonNullable<MutableCompilerContext['scanService']>['appEntry']
  ctx.configService = { weappLibConfig: { enabled: true } } as typeof ctx.configService
  expect(await captureAppShellSnapshot(ctx)).toBeUndefined()
})
