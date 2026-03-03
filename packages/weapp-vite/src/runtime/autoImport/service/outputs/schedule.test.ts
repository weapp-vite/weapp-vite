import type { OutputsState } from './state'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createScheduleHelpers } from './schedule'

const loggerErrorMock = vi.hoisted(() => vi.fn())

vi.mock('../../../../context/shared', () => ({
  logger: {
    error: loggerErrorMock,
  },
}))

function createOutputsState(): OutputsState {
  return {
    pendingWrite: undefined,
    writeRequested: false,
    pendingTypedWrite: undefined,
    typedWriteRequested: false,
    lastWrittenTypedDefinition: undefined,
    lastTypedDefinitionOutputPath: undefined,
    pendingHtmlCustomDataWrite: undefined,
    htmlCustomDataWriteRequested: false,
    lastWrittenHtmlCustomData: undefined,
    lastHtmlCustomDataOutputPath: undefined,
    pendingVueComponentsWrite: undefined,
    vueComponentsWriteRequested: false,
    lastWrittenVueComponentsDefinition: undefined,
    lastVueComponentsOutputPath: undefined,
    lastHtmlCustomDataEnabled: false,
    lastHtmlCustomDataOutput: undefined,
    lastTypedComponentsEnabled: false,
    lastTypedComponentsOutput: undefined,
    lastVueComponentsEnabled: false,
    lastVueComponentsOutput: undefined,
  }
}

function createCtx(autoImportComponents: any) {
  return {
    configService: {
      cwd: '/project',
      currentSubPackageRoot: undefined,
      weappViteConfig: {
        autoImportComponents,
      },
    },
  } as any
}

describe('autoImport schedule helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips manifest writes when disabled or no output path', async () => {
    const disabledState = createOutputsState()
    const writeWhenDisabled = vi.fn(async () => {})
    const disabledHelpers = createScheduleHelpers({
      ctx: createCtx(false),
      outputsState: disabledState,
      manifestFileName: 'auto-import-components.json',
      writeManifest: writeWhenDisabled,
      syncTyped: vi.fn(),
      syncHtmlCustomData: vi.fn(),
      syncVueComponents: vi.fn(),
    })

    await disabledHelpers.scheduleManifestWrite(true)
    expect(writeWhenDisabled).not.toHaveBeenCalled()
    expect(disabledState.pendingWrite).toBeUndefined()

    const noOutputState = createOutputsState()
    const writeWithNoOutput = vi.fn(async () => {})
    const noOutputHelpers = createScheduleHelpers({
      ctx: createCtx({ output: false }),
      outputsState: noOutputState,
      manifestFileName: 'auto-import-components.json',
      writeManifest: writeWithNoOutput,
      syncTyped: vi.fn(),
      syncHtmlCustomData: vi.fn(),
      syncVueComponents: vi.fn(),
    })

    await noOutputHelpers.scheduleManifestWrite(true)
    await noOutputState.pendingWrite
    expect(writeWithNoOutput).not.toHaveBeenCalled()

    await noOutputHelpers.scheduleManifestWrite(false)
    expect(writeWithNoOutput).not.toHaveBeenCalled()
  })

  it('coalesces manifest writes and logs errors from writer', async () => {
    const outputsState = createOutputsState()
    let releaseFirstWrite: (() => void) | undefined
    const firstWriteDone = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve
    })

    const writeManifest = vi.fn(async () => {
      if (writeManifest.mock.calls.length === 1) {
        await firstWriteDone
        return
      }
      throw new Error('manifest failed')
    })

    const helpers = createScheduleHelpers({
      ctx: createCtx({ output: true }),
      outputsState,
      manifestFileName: 'auto-import-components.json',
      writeManifest,
      syncTyped: vi.fn(),
      syncHtmlCustomData: vi.fn(),
      syncVueComponents: vi.fn(),
    })

    await helpers.scheduleManifestWrite(true)
    await vi.waitFor(() => {
      expect(writeManifest).toHaveBeenCalledTimes(1)
    })

    await helpers.scheduleManifestWrite(true)
    releaseFirstWrite?.()
    await outputsState.pendingWrite

    expect(writeManifest).toHaveBeenCalledTimes(2)
    expect(loggerErrorMock).toHaveBeenCalledWith(expect.stringContaining('自动导出组件清单失败: manifest failed'))
    expect(outputsState.pendingWrite).toBeUndefined()
  })

  it('schedules typed outputs on config change and queued writes', async () => {
    const outputsState = createOutputsState()
    const ctx = createCtx({ typedComponents: false })
    let releaseFirstSync: (() => void) | undefined
    const firstSyncDone = new Promise<void>((resolve) => {
      releaseFirstSync = resolve
    })

    const syncTyped = vi.fn(async () => {
      if (syncTyped.mock.calls.length === 2) {
        await firstSyncDone
      }
    })

    const helpers = createScheduleHelpers({
      ctx,
      outputsState,
      manifestFileName: 'auto-import-components.json',
      writeManifest: vi.fn(),
      syncTyped,
      syncHtmlCustomData: vi.fn(),
      syncVueComponents: vi.fn(),
    })

    helpers.scheduleTypedComponentsWrite(false)
    expect(syncTyped).not.toHaveBeenCalled()

    outputsState.lastTypedComponentsEnabled = true
    helpers.scheduleTypedComponentsWrite(false)
    await outputsState.pendingTypedWrite
    expect(syncTyped).toHaveBeenCalledTimes(1)
    expect(syncTyped).toHaveBeenLastCalledWith({ enabled: false })

    ctx.configService.weappViteConfig.autoImportComponents.typedComponents = true
    helpers.scheduleTypedComponentsWrite(true)
    await vi.waitFor(() => {
      expect(syncTyped).toHaveBeenCalledTimes(2)
    })

    helpers.scheduleTypedComponentsWrite(true)
    releaseFirstSync?.()
    await outputsState.pendingTypedWrite

    expect(syncTyped).toHaveBeenCalledTimes(3)
    expect(syncTyped).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }))
    expect(outputsState.pendingTypedWrite).toBeUndefined()
  })

  it('handles html/vue scheduling guards and retries', async () => {
    const outputsState = createOutputsState()
    const ctx = createCtx({
      htmlCustomData: false,
      vueComponents: false,
    })

    let releaseFirstVueSync: (() => void) | undefined
    const firstVueSyncDone = new Promise<void>((resolve) => {
      releaseFirstVueSync = resolve
    })

    const syncHtml = vi.fn(async () => {})
    const syncVue = vi.fn(async () => {
      if (syncVue.mock.calls.length === 2) {
        await firstVueSyncDone
      }
    })

    const helpers = createScheduleHelpers({
      ctx,
      outputsState,
      manifestFileName: 'auto-import-components.json',
      writeManifest: vi.fn(),
      syncTyped: vi.fn(),
      syncHtmlCustomData: syncHtml,
      syncVueComponents: syncVue,
    })

    helpers.scheduleHtmlCustomDataWrite(false)
    helpers.scheduleVueComponentsWrite(false)
    expect(syncHtml).not.toHaveBeenCalled()
    expect(syncVue).not.toHaveBeenCalled()

    outputsState.lastHtmlCustomDataOutputPath = '/project/mini-program.html-data.json'
    helpers.scheduleHtmlCustomDataWrite(false)
    await outputsState.pendingHtmlCustomDataWrite
    expect(syncHtml).toHaveBeenCalledTimes(1)

    outputsState.lastVueComponentsEnabled = true
    helpers.scheduleVueComponentsWrite(false)
    await outputsState.pendingVueComponentsWrite
    expect(syncVue).toHaveBeenCalledTimes(1)

    ctx.configService.weappViteConfig.autoImportComponents.vueComponents = true
    helpers.scheduleVueComponentsWrite(true)
    await vi.waitFor(() => {
      expect(syncVue).toHaveBeenCalledTimes(2)
    })

    helpers.scheduleVueComponentsWrite(true)
    releaseFirstVueSync?.()
    await outputsState.pendingVueComponentsWrite

    expect(syncVue).toHaveBeenCalledTimes(3)
    expect(syncVue).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }))
    expect(outputsState.pendingHtmlCustomDataWrite).toBeUndefined()
    expect(outputsState.pendingVueComponentsWrite).toBeUndefined()
  })
})
