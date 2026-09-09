import type { createHmrRuntimeDiagnostics } from '../../utils/hmrRuntimeDiagnostics'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY } from '@weapp-core/constants'
import { expect } from 'vitest'
import { replaceFileByRename } from '../../utils/hmr-helpers'

export const tdesignNativeScriptCheckpoints = [
  { id: 'native-script:initial', route: '/pages/index/index', action: '脚本更新前验收原生页面初始浅色模式', nodes: [
    { selector: '#tailwind-mode', text: '当前模式 light 切换模式', visible: true },
  ] },
  { id: 'native-script:dark', route: '/pages/index/index', action: '实际点击原生模式控件，确认切换暗色后再开始脚本更新', nodes: [
    { selector: '#tailwind-mode', text: '当前模式 dark 切换模式', visible: true },
  ] },
  { id: 'native-script:patched-state', route: '/pages/index/index', action: '外置 npm 页面脚本更新后保留暗色模式', nodes: [
    { selector: '#tailwind-mode', text: '当前模式 dark 切换模式', visible: true },
  ] },
  { id: 'native-script:patched-tap', route: '/pages/index/index', action: '点击模式控件，更新后的方法显示 npm-dark，区别于原方法切换 light', nodes: [
    { selector: '#tailwind-mode', text: '当前模式 npm-dark 切换模式', visible: true },
  ] },
  { id: 'native-script:restored-state', route: '/pages/index/index', action: '恢复原生脚本后仍保留 npm-dark 交互状态', nodes: [
    { selector: '#tailwind-mode', text: '当前模式 npm-dark 切换模式', visible: true },
  ] },
  { id: 'native-script:restored-tap', route: '/pages/index/index', action: '实际点击恢复后的方法，模式切换为 light', nodes: [
    { selector: '#tailwind-mode', text: '当前模式 light 切换模式', visible: true },
  ] },
]

async function readClientVersion(miniProgram: any): Promise<number> {
  const version: unknown = await miniProgram.evaluate((key: string) => {
    const client = (globalThis as any)[key]
    return client?.getVersion?.()
  }, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)
  if (typeof version !== 'number' || !Number.isFinite(version)) {
    throw new TypeError('Stateful HMR client version is unavailable')
  }
  return version
}

async function waitForAppliedPatch(miniProgram: any, previous: number) {
  const deadline = Date.now() + 30_000
  let latest = previous
  while (Date.now() < deadline) {
    latest = await readClientVersion(miniProgram)
    if (latest > previous) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Stateful HMR patch was not applied: previous=${previous}, latest=${latest}`)
}

/** 在共享页面上更新与恢复含外置 npm import 的原生方法，由调用方独立验收点击后的 DOM。 */
export function createTdesignNativeScriptUpdate(options: {
  diagnostics: ReturnType<typeof createHmrRuntimeDiagnostics>
  initialIdentity: Awaited<ReturnType<ReturnType<typeof createHmrRuntimeDiagnostics>['initialize']>>
  miniProgram: any
  originalSource: string
  sourceFile: string
}) {
  const { diagnostics, miniProgram, originalSource, sourceFile } = options
  expect(originalSource).toContain('import ActionSheet, { ActionSheetTheme } from \'tdesign-miniprogram/action-sheet/index\'')
  const updatedSource = originalSource.replace(/ {2}switchMode\(\) \{[\s\S]*?\n {2}\},\n {2}async copy/, `  switchMode() {
    this.setData({ mode: 'npm-dark' })
  },
  async copy`)
  expect(updatedSource).not.toBe(originalSource)
  const checkIdentity = async (id: string) => {
    const identity = await diagnostics.capture(id)
    expect(identity.errors).toEqual([])
    expect(identity.pageId).toBe(options.initialIdentity.pageId)
    expect(identity.runtime).toMatchObject({
      pageMarkerRetained: true,
      appMarkerRetained: true,
      appLaunchProbe: options.initialIdentity.runtime?.appLaunchProbe,
    })
  }
  const update = async (source: string) => {
    const version = await readClientVersion(miniProgram)
    await replaceFileByRename(sourceFile, source)
    await waitForAppliedPatch(miniProgram, version)
  }
  return {
    patch: () => update(updatedSource),
    restore: () => update(originalSource),
    checkIdentity,
  }
}
