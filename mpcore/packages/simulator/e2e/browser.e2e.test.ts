import type { App as VueApp } from 'vue'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import SimulatorE2EApp from '../../../demos/web/src/e2e/SimulatorE2EApp.vue'
import '../../../demos/web/src/styles.css'

interface SimulatorE2EApi {
  callComponentMethod: (scopeId: string, method: string, ...args: any[]) => unknown
  findComponentScopeIds: (selector: string) => string[]
  getState: () => {
    appData: string
    currentRoute: string
    currentScenarioId: string
    pageData: string
    pageRoutes: string[]
    pageStack: string[]
    previewMarkup: string
    requestLogData: string
    selectedScope: { scopeId?: string, type?: string } | null
    storageData: string
    toastData: string
    viewportSize: { height: number, width: number }
  }
  navigateBack: (delta?: number) => void
  openRoute: (route: string) => void
  pickScenario: (scenarioId: string) => void
  readScopeSnapshot: (scopeId: string) => unknown
  renderCurrentPage: () => string
  runPageMethod: (method: string) => void
  sessionSnapshot: () => {
    actionSheetLogs: unknown[]
    directorySnapshot: string[]
    downloadFileLogs: unknown[]
    fileSnapshot: Record<string, string>
    modalLogs: unknown[]
    pullDownRefreshState: { active: boolean, stopCalls: number } | null
    requestLogs: unknown[]
    savedFileList: Array<{ createTime: number, filePath: string, size: number }>
    shareMenu: unknown
    storageSnapshot: Record<string, unknown>
    tabBarSnapshot: unknown
    toast: unknown
    uploadFileLogs: unknown[]
  }
  triggerPullDownRefresh: () => void
  triggerReachBottom: () => void
  triggerResize: (width: number, height: number) => void
  triggerRouteDone: (payload?: Record<string, unknown>) => void
}

function getBridge() {
  return (window as any).__SIMULATOR_E2E__ as SimulatorE2EApi | undefined
}

async function waitFor<T>(
  read: () => T,
  predicate: (value: T) => boolean,
  timeout = 30_000,
  interval = 50,
) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const value = read()
    if (predicate(value)) {
      return value
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  throw new Error('[simulator-browser-e2e] Timed out waiting for condition.')
}

function parseJsonString<T>(value: string): T {
  return JSON.parse(value) as T
}

describe.sequential('simulator browser e2e', () => {
  let app: VueApp | undefined
  let mountNode: HTMLDivElement | undefined

  beforeAll(async () => {
    mountNode = document.createElement('div')
    mountNode.id = 'app'
    document.body.innerHTML = ''
    document.body.appendChild(mountNode)
    app = createApp(SimulatorE2EApp)
    app.mount(mountNode)

    await waitFor(
      () => getBridge(),
      bridge => typeof bridge?.getState === 'function',
    )
  })

  beforeEach(async () => {
    const bridge = getBridge()!
    bridge.pickScenario('wechat-template')
    await waitFor(
      () => bridge.getState(),
      state => state.currentScenarioId === 'wechat-template' && state.currentRoute === 'pages/index/index',
      20_000,
    )
  })

  afterAll(() => {
    app?.unmount()
    mountNode?.remove()
  })

  it('boots the demo with the default scenario and renders a page', () => {
    const state = getBridge()!.getState()
    expect(state.currentScenarioId).toBe('wechat-template')
    expect(state.currentRoute).toBe('pages/index/index')
    expect(state.pageStack).toEqual(['pages/index/index'])
    expect(state.previewMarkup).toContain('page')
  })

  it('switches scenarios and keeps browser session runtime functional', async () => {
    const bridge = getBridge()!
    bridge.pickScenario('component-lab')

    await waitFor(
      () => bridge.getState(),
      state => state.currentScenarioId === 'component-lab' && state.currentRoute === 'pages/lab/index',
      20_000,
    )

    bridge.runPageMethod('inspectCard')
    bridge.runPageMethod('runFileManagerLab')
    bridge.runPageMethod('loadMockQueue')
    bridge.runPageMethod('runFileTransferLab')
    bridge.runPageMethod('runSavedOverwriteLab')
    bridge.runPageMethod('runSavedOrderingLab')
    bridge.runPageMethod('runSavedRemovalLab')
    bridge.runPageMethod('runSavedMissingRemovalLab')
    bridge.runPageMethod('runSavedRenameOutLab')
    bridge.runPageMethod('storeSnapshot')
    bridge.runPageMethod('toastSnapshot')

    const state = await waitFor(
      () => bridge.getState(),
      (nextState) => {
        const pageData = parseJsonString<Record<string, any>>(nextState.pageData)
        return Boolean(
          pageData.componentSnapshot
          && pageData.directorySnapshot
          && pageData.downloadSnapshot
          && pageData.fileManagerSnapshot
          && pageData.requestSnapshot
          && pageData.savedFileInfo
          && pageData.savedOrderingInfo
          && pageData.savedOverwriteInfo
          && pageData.savedFilePath
          && pageData.savedMissingRemovalInfo
          && pageData.savedRemovalInfo
          && pageData.savedRenameOutInfo
          && pageData.storageSnapshot
          && pageData.toastState
          && pageData.uploadedSnapshot,
        )
      },
      20_000,
    )

    const pageData = parseJsonString<Record<string, any>>(state.pageData)
    expect(pageData.componentSnapshot).toContain('"size":1')
    expect(pageData.directorySnapshot).toBe('["daily"]')
    expect(pageData.downloadSnapshot).toContain('"errMsg":"downloadFile:ok"')
    expect(pageData.fileManagerSnapshot).toContain('"isDirectory":true')
    expect(pageData.fileManagerSnapshot).toContain('"isFile":true')
    expect(pageData.fileManagerSnapshot).toContain('"text":"component-lab"')
    expect(pageData.fileManagerSnapshot).toContain('"archiveRemoved":true')
    expect(pageData.requestSnapshot).toContain('"queue":"alpha"')
    expect(pageData.savedFileInfo).toContain('"errMsg":"getSavedFileInfo:ok"')
    expect(pageData.savedFileInfo).toContain('"size":20')
    expect(pageData.savedOrderingInfo).toContain('"createTimesArePositive":true')
    expect(pageData.savedOrderingInfo).toContain('"headless://saved/component-lab/ordering/alpha.txt"')
    expect(pageData.savedOrderingInfo).toContain('"headless://saved/component-lab/ordering/zeta.txt"')
    expect(pageData.savedOverwriteInfo).toContain('"afterSize":14')
    expect(pageData.savedOverwriteInfo).toContain('"filePath":"headless://saved/component-lab/snapshots/report.txt"')
    expect(pageData.savedFilePath).toContain('headless://wxfile/saved/')
    expect(pageData.savedMissingRemovalInfo).toContain('"missingRemoveError":"removeSavedFile:fail no such file or directory')
    expect(pageData.savedRemovalInfo).toContain('"hasSavedRegistration":false')
    expect(pageData.savedRemovalInfo).toContain('"removeErrMsg":"removeSavedFile:ok"')
    expect(pageData.savedRemovalInfo).toContain('"missingInfoError":"getSavedFileInfo:fail no such file or directory')
    expect(pageData.savedRenameOutInfo).toContain('"hasSavedRegistration":false')
    expect(pageData.savedRenameOutInfo).toContain('"movedText":"rename-out"')
    expect(pageData.storageSnapshot).toContain('"status"')
    expect(pageData.toastState).toContain('showToast:ok')
    expect(pageData.uploadedSnapshot).toContain('"accepted":true')
    const savedOverwriteInfo = parseJsonString<{ afterCreateTime: number, afterSize: number, beforeCreateTime: number, filePath: string }>(pageData.savedOverwriteInfo)
    expect(savedOverwriteInfo.afterCreateTime).toBe(savedOverwriteInfo.beforeCreateTime)
    const savedOrderingInfo = parseJsonString<{ createTimesArePositive: boolean, filePaths: string[] }>(pageData.savedOrderingInfo)
    expect(savedOrderingInfo.filePaths).toEqual([
      'headless://saved/component-lab/ordering/alpha.txt',
      'headless://saved/component-lab/ordering/zeta.txt',
    ])

    const scopeIds = bridge.findComponentScopeIds('status-card')
    expect(scopeIds).toHaveLength(1)
    expect(bridge.readScopeSnapshot(scopeIds[0])).toMatchObject({
      properties: {
        count: 3,
      },
      type: 'component',
    })

    bridge.callComponentMethod(scopeIds[0], 'inspectNested')
    const nestedSnapshot = await waitFor(
      () => bridge.readScopeSnapshot(scopeIds[0]) as Record<string, any> | null,
      snapshot => Boolean(snapshot?.data?.nestedBadge),
      20_000,
    )
    expect(nestedSnapshot?.data?.nestedBadge).toContain('"label":"stable"')
    expect(nestedSnapshot?.data?.nestedBadge).toContain('"size":1')

    const sessionSnapshot = bridge.sessionSnapshot()
    expect(sessionSnapshot.directorySnapshot).toContain('headless://saved/component-lab/reports')
    expect(sessionSnapshot.directorySnapshot).toContain('headless://saved/component-lab/reports/daily')
    expect(sessionSnapshot.directorySnapshot).not.toContain('headless://saved/component-lab/archive')
    expect(sessionSnapshot.downloadFileLogs).toHaveLength(1)
    expect(sessionSnapshot.savedFileList).toContainEqual(expect.objectContaining({
      filePath: pageData.savedFilePath,
      size: 'component-lab report'.length,
    }))
    expect(sessionSnapshot.savedFileList).toContainEqual(expect.objectContaining({
      filePath: 'headless://saved/component-lab/ordering/alpha.txt',
      size: 'alpha'.length,
    }))
    expect(sessionSnapshot.savedFileList).toContainEqual(expect.objectContaining({
      filePath: 'headless://saved/component-lab/ordering/zeta.txt',
      size: 'zeta'.length,
    }))
    expect(sessionSnapshot.savedFileList).toContainEqual(expect.objectContaining({
      filePath: 'headless://saved/component-lab/snapshots/report.txt',
      size: 'second-version'.length,
    }))
    expect(sessionSnapshot.savedFileList).not.toContainEqual(expect.objectContaining({
      filePath: 'headless://saved/component-lab/removals/report.txt',
    }))
    expect(sessionSnapshot.savedFileList).not.toContainEqual(expect.objectContaining({
      filePath: 'headless://saved/component-lab/transfers/rename-out.txt',
    }))
    expect(sessionSnapshot.uploadFileLogs).toHaveLength(1)
    expect(Object.values(sessionSnapshot.fileSnapshot)).toContain('component-lab report')
    expect(Object.values(sessionSnapshot.fileSnapshot)).toContain('component-lab')
    expect(sessionSnapshot.fileSnapshot['headless://saved/component-lab/removals/report.txt']).toBeUndefined()
    expect(sessionSnapshot.fileSnapshot['headless://temp/component-lab-renamed.txt']).toBe('rename-out')
  })

  it('drives browser session host features through the demo workbench api', async () => {
    const bridge = getBridge()!
    bridge.pickScenario('route-maze')

    await waitFor(
      () => bridge.getState(),
      state => state.currentScenarioId === 'route-maze',
      20_000,
    )

    bridge.runPageMethod('openQueue')
    await waitFor(
      () => bridge.getState(),
      state => state.currentRoute === 'package-flow/queue/index',
      20_000,
    )

    bridge.runPageMethod('openDetail')
    await waitFor(
      () => bridge.getState(),
      state => state.currentRoute === 'package-flow/detail/index',
      20_000,
    )

    bridge.triggerResize(390, 844)
    bridge.triggerRouteDone({ from: 'browser-e2e' })
    bridge.triggerPullDownRefresh()
    bridge.triggerReachBottom()
    bridge.navigateBack(1)

    const state = await waitFor(
      () => bridge.getState(),
      nextState => nextState.currentRoute === 'package-flow/queue/index',
      20_000,
    )
    expect(state.viewportSize).toEqual({ width: 390, height: 844 })

    const snapshot = bridge.sessionSnapshot()
    expect(Array.isArray(snapshot.requestLogs)).toBe(true)
    expect(snapshot.pullDownRefreshState).toEqual({
      active: true,
      stopCalls: 0,
    })
    expect(snapshot.storageSnapshot).toBeTypeOf('object')
  })

  it('tracks browser route stack transitions through runtime navigation', async () => {
    const bridge = getBridge()!
    bridge.pickScenario('route-maze')

    await waitFor(
      () => bridge.getState(),
      state => state.currentScenarioId === 'route-maze' && state.currentRoute === 'pages/hub/index',
      20_000,
    )

    bridge.runPageMethod('openQueue')
    await waitFor(
      () => bridge.getState(),
      state => state.currentRoute === 'package-flow/queue/index' && state.pageStack.length === 2,
      20_000,
    )

    bridge.runPageMethod('openDetail')
    const detailState = await waitFor(
      () => bridge.getState(),
      state => state.currentRoute === 'package-flow/detail/index' && state.pageStack.length === 3,
      20_000,
    )
    expect(detailState.pageStack).toEqual([
      'pages/hub/index',
      'package-flow/queue/index',
      'package-flow/detail/index',
    ])

    bridge.navigateBack(2)
    const backState = await waitFor(
      () => bridge.getState(),
      state => state.currentRoute === 'pages/hub/index' && state.pageStack.length === 1,
      20_000,
    )
    expect(backState.pageStack).toEqual(['pages/hub/index'])
  })
})
