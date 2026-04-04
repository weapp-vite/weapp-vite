import type { App as VueApp } from 'vue'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import SimulatorE2EApp from '../../../demos/web/src/e2e/SimulatorE2EApp.vue'
import '../../../demos/web/src/styles.css'

interface SimulatorE2EApi {
  callComponentMethod: (scopeId: string, method: string, ...args: any[]) => unknown
  dispatchTapChain: (payload: {
    activeScopeId: string
    chain: Array<{
      event: {
        currentTarget: { dataset: Record<string, string>, id: string }
        target: { dataset: Record<string, string>, id: string }
      }
      method: string
      scopeId: string
      stopAfter: boolean
    }>
  }) => void
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
  mockActionSheet: (definition?: { cancel?: boolean, tapIndex?: number }) => void
  mockModal: (definition?: { cancel?: boolean, confirm?: boolean }) => void
  navigateBack: (delta?: number) => void
  openRoute: (route: string) => void
  pickScenario: (scenarioId: string) => void
  selectScope: (scopeId: string) => void
  readScopeSnapshot: (scopeId: string) => unknown
  renderCurrentPage: () => string
  runPageMethod: (method: string) => void
  setNetworkType: (networkType: 'wifi' | '2g' | '3g' | '4g' | '5g' | 'none' | 'unknown') => void
  sessionSnapshot: () => {
    actionSheetLogs: unknown[]
    currentPageBackground: unknown
    currentPageNavigationBar: unknown
    directorySnapshot: string[]
    downloadFileLogs: unknown[]
    fileSnapshot: Record<string, string>
    modalLogs: unknown[]
    networkType: unknown
    previewImage: unknown
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
    bridge.runPageMethod('inspectCardIntersection')
    bridge.runPageMethod('inspectCardMedia')
    bridge.runPageMethod('inspectCardVideo')
    bridge.runPageMethod('inspectCompoundCard')
    bridge.runPageMethod('inspectScopedComponentQuery')
    bridge.runPageMethod('inspectScopedSelectAll')
    bridge.runPageMethod('inspectScopedMetaQuery')
    bridge.runPageMethod('inspectCompoundSelector')
    bridge.runPageMethod('runVideoContextLab')
    bridge.runPageMethod('runIntersectionObserverLab')
    bridge.runPageMethod('runMediaQueryObserverLab')
    bridge.runPageMethod('runAnimationLab')
    bridge.runPageMethod('runCanvasLab')
    bridge.runPageMethod('exportCanvasLab')
    bridge.runPageMethod('saveExportedCanvasLab')
    bridge.runPageMethod('saveMissingCanvasImageLab')
    bridge.runPageMethod('inspectExportedCanvasImageLab')
    bridge.runPageMethod('inspectMissingCanvasImageLab')
    bridge.runPageMethod('previewCanvasImageLab')
    bridge.runPageMethod('previewInvalidCanvasImageLab')
    bridge.runPageMethod('chooseImageLab')
    bridge.runPageMethod('chooseMessageFileLab')
    bridge.runPageMethod('inspectFileInfoLab')
    bridge.runPageMethod('inspectMissingFileInfoLab')
    bridge.runPageMethod('openDocumentLab')
    bridge.runPageMethod('openMissingDocumentLab')
    bridge.runPageMethod('startPullDownRefreshLab')
    bridge.runPageMethod('clipboardLab')
    bridge.runPageMethod('loadingLab')
    bridge.runPageMethod('showShareMenuLab')
    bridge.runPageMethod('updateShareMenuLab')
    bridge.runPageMethod('hideShareMenuLab')
    bridge.runPageMethod('openDefaultModalLab')
    bridge.mockModal({ confirm: false })
    bridge.runPageMethod('openCancelModalLab')
    bridge.runPageMethod('openDefaultActionSheetLab')
    bridge.mockActionSheet({ cancel: true })
    bridge.runPageMethod('openCancelActionSheetLab')
    bridge.runPageMethod('hideTabBarLab')
    bridge.runPageMethod('showTabBarLab')
    bridge.runPageMethod('showTabBarDotLab')
    bridge.runPageMethod('setTabBarBadgeLab')
    bridge.runPageMethod('removeTabBarBadgeLab')
    bridge.runPageMethod('showTabBarDotLab')
    bridge.runPageMethod('hideTabBarDotLab')
    bridge.runPageMethod('updateNavigationTitleLab')
    bridge.runPageMethod('updateNavigationColorLab')
    bridge.runPageMethod('showNavigationLoadingLab')
    bridge.runPageMethod('hideNavigationLoadingLab')
    bridge.runPageMethod('setLightBackgroundLab')
    bridge.runPageMethod('setBackgroundColorLab')
    bridge.runPageMethod('setInvalidBackgroundLab')
    bridge.runPageMethod('startWatchingNetworkLab')
    bridge.runPageMethod('inspectNetworkLab')
    bridge.setNetworkType('none')
    bridge.setNetworkType('4g')
    bridge.runPageMethod('stopWatchingNetworkLab')
    bridge.setNetworkType('5g')
    bridge.runPageMethod('compressChosenImageLab')
    bridge.runPageMethod('compressMissingImageLab')
    bridge.runPageMethod('chooseVideoLab')
    bridge.runPageMethod('saveMissingChosenVideoLab')
    bridge.runPageMethod('inspectChosenVideoLab')
    bridge.runPageMethod('inspectMissingChosenVideoLab')
    bridge.runPageMethod('chooseMediaLab')
    bridge.runPageMethod('saveTempVideoLab')
    bridge.runPageMethod('saveMissingTempVideoLab')
    bridge.runPageMethod('inspectCanvasQuery')
    bridge.triggerResize(412, 915)
    bridge.runPageMethod('runFileManagerLab')
    bridge.runPageMethod('runMissingStatLab')
    bridge.runPageMethod('runMissingReadDirLab')
    bridge.runPageMethod('runMissingReadFileLab')
    bridge.runPageMethod('runMissingUnlinkLab')
    bridge.runPageMethod('runMissingCopyFileLab')
    bridge.runPageMethod('runMissingMkdirLab')
    bridge.runPageMethod('runMissingRenameLab')
    bridge.runPageMethod('runMissingRmdirLab')
    bridge.runPageMethod('runMissingAccessLab')
    bridge.runPageMethod('runUnsupportedWriteEncodingLab')
    bridge.runPageMethod('runUnsupportedAppendEncodingLab')
    bridge.runPageMethod('runUnsupportedReadEncodingLab')
    bridge.runPageMethod('loadMockQueue')
    bridge.runPageMethod('runFileTransferLab')
    bridge.runPageMethod('runFileTransferFailureLab')
    bridge.runPageMethod('runSaveFileMissingTempLab')
    bridge.runPageMethod('runSavedCopyOverwriteLab')
    bridge.runPageMethod('runSavedOverwriteLab')
    bridge.runPageMethod('runSavedOrderingLab')
    bridge.runPageMethod('runSavedRemovalLab')
    bridge.runPageMethod('runSavedMissingInfoLab')
    bridge.runPageMethod('runSavedMissingRemovalLab')
    bridge.runPageMethod('runSavedRenameOverwriteLab')
    bridge.runPageMethod('runSavedRenameOutLab')
    bridge.runPageMethod('storeSnapshot')
    bridge.runPageMethod('toastSnapshot')

    const state = await waitFor(
      () => bridge.getState(),
      (nextState) => {
        const pageData = parseJsonString<Record<string, any>>(nextState.pageData)
        return Boolean(
          pageData.componentSnapshot
          && pageData.compoundComponentSnapshot
          && pageData.scopedComponentRect
          && pageData.scopedComponentList
          && pageData.scopedComponentMeta
          && pageData.compoundSelectorSnapshot
          && pageData.intersectionObserverSnapshot
          && pageData.mediaQueryObserverSnapshot
          && pageData.animationSnapshot
          && pageData.canvasSnapshot
          && pageData.canvasSavedImageInfo
          && pageData.canvasSavedImageMissingInfo
          && pageData.canvasImageInfo
          && pageData.canvasImageInfoMissing
          && pageData.previewImageInfo
          && pageData.previewImageInvalidInfo
          && pageData.chosenImageInfo
          && pageData.chosenImageDetail
          && pageData.chosenMessageFileInfo
          && pageData.chosenMessageFileImageDetail
          && pageData.chosenMessageFileVideoDetail
          && pageData.tempFileInfo
          && pageData.savedFileDigestInfo
          && pageData.missingFileInfo
          && pageData.openDocumentInfo
          && pageData.openSavedDocumentInfo
          && pageData.openMissingDocumentInfo
          && pageData.startPullDownRefreshInfo
          && pageData.pullDownRefreshInfo
          && pageData.clipboardSetInfo
          && pageData.clipboardReadInfo
          && pageData.loadingShownInfo
          && pageData.loadingHiddenInfo
          && pageData.shareMenuShownInfo
          && pageData.shareMenuUpdatedInfo
          && pageData.shareMenuHiddenInfo
          && pageData.modalDefaultInfo
          && pageData.modalCancelInfo
          && pageData.actionSheetDefaultInfo
          && pageData.actionSheetCancelInfo
          && pageData.tabBarHiddenInfo
          && pageData.tabBarShownInfo
          && pageData.tabBarDotInfo
          && pageData.tabBarHideDotInfo
          && pageData.tabBarBadgeInfo
          && pageData.tabBarRemoveBadgeInfo
          && pageData.navigationBarTitleInfo
          && pageData.navigationBarColorInfo
          && pageData.navigationBarLoadingShownInfo
          && pageData.navigationBarLoadingHiddenInfo
          && pageData.backgroundLightInfo
          && pageData.backgroundColorInfo
          && pageData.backgroundInvalidInfo
          && pageData.networkInitialInfo
          && pageData.networkCurrentInfo
          && Array.isArray(pageData.networkLogs)
          && pageData.networkLogs.length === 3
          && pageData.compressedImageInfo
          && pageData.compressedImageDetail
          && pageData.compressedImageMissingInfo
          && pageData.chosenVideoInfo
          && pageData.chosenVideoSavedInfo
          && pageData.chosenVideoMissingSaveInfo
          && pageData.chosenVideoDetail
          && pageData.chosenVideoDetailMissing
          && pageData.chosenMediaInfo
          && pageData.chosenMediaImageDetail
          && pageData.chosenMediaVideoSavedInfo
          && pageData.chosenMediaVideoDetail
          && pageData.tempVideoSavedInfo
          && pageData.tempVideoSavedMissingInfo
          && pageData.canvasTempFileContent
          && pageData.canvasTempFilePath
          && pageData.canvasQuerySnapshot
          && pageData.videoContextSnapshot
          && pageData.directorySnapshot
          && pageData.downloadSnapshot
          && pageData.fileTransferFailureInfo
          && pageData.fileManagerMissingAccessInfo
          && pageData.fileManagerMissingCopyInfo
          && pageData.fileManagerMissingMkdirInfo
          && pageData.fileManagerMissingReadInfo
          && pageData.fileManagerMissingReadDirInfo
          && pageData.fileManagerMissingRenameInfo
          && pageData.fileManagerMissingRmdirInfo
          && pageData.fileManagerMissingStatInfo
          && pageData.fileManagerMissingUnlinkInfo
          && pageData.fileManagerUnsupportedAppendEncodingInfo
          && pageData.fileManagerUnsupportedReadEncodingInfo
          && pageData.fileManagerUnsupportedWriteEncodingInfo
          && pageData.fileManagerSnapshot
          && pageData.requestSnapshot
          && pageData.savedFileInfo
          && pageData.saveFileMissingTempInfo
          && pageData.savedCopyOverwriteInfo
          && pageData.savedOrderingInfo
          && pageData.savedOverwriteInfo
          && pageData.savedFilePath
          && pageData.savedMissingInfo
          && pageData.savedMissingRemovalInfo
          && pageData.savedPostRemovalReadInfo
          && pageData.savedRenameOverwriteInfo
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
    expect(pageData.compoundComponentSnapshot).toContain('"count":3')
    expect(pageData.compoundComponentSnapshot).toContain('"status":"stable"')
    expect(pageData.compoundComponentSnapshot).toContain('"size":1')
    expect(pageData.compoundSelectorSnapshot).toContain('"id":"status-card-pulse"')
    expect(pageData.compoundSelectorSnapshot).toContain('"phase":"pulse"')
    expect(pageData.intersectionObserverSnapshot).toContain('"id":"observer-card"')
    expect(pageData.intersectionObserverSnapshot).toContain('"intersectionRatio":1')
    expect(pageData.intersectionObserverSnapshot).toContain('"top":24')
    expect(pageData.mediaQueryObserverSnapshot).toContain('"matches":true')
    expect(pageData.mediaQueryObserverSnapshot).toContain('"width":412')
    expect(pageData.animationSnapshot).toContain('"type":"opacity"')
    expect(pageData.animationSnapshot).toContain('"type":"rotate"')
    expect(pageData.canvasSnapshot).toContain('"canvasId":"lab-canvas"')
    expect(pageData.canvasSnapshot).toContain('"type":"beginPath"')
    expect(pageData.canvasSnapshot).toContain('"type":"arc"')
    expect(pageData.canvasSnapshot).toContain('"type":"arcTo"')
    expect(pageData.canvasSnapshot).toContain('"type":"bezierCurveTo"')
    expect(pageData.canvasSnapshot).toContain('"type":"clip"')
    expect(pageData.canvasSnapshot).toContain('"args":["evenodd"]')
    expect(pageData.canvasSnapshot).toContain('"type":"quadraticCurveTo"')
    expect(pageData.canvasSnapshot).toContain('"type":"rect"')
    expect(pageData.canvasSnapshot).toContain('"type":"save"')
    expect(pageData.canvasSnapshot).toContain('"type":"restore"')
    expect(pageData.canvasSnapshot).toContain('"type":"setLineCap"')
    expect(pageData.canvasSnapshot).toContain('"type":"setLineDash"')
    expect(pageData.canvasSnapshot).toContain('"type":"setLineJoin"')
    expect(pageData.canvasSnapshot).toContain('"type":"setMiterLimit"')
    expect(pageData.canvasSnapshot).toContain('"type":"fillText"')
    expect(pageData.canvasSnapshot).toContain('"type":"setFontSize"')
    expect(pageData.canvasSnapshot).toContain('"type":"setGlobalAlpha"')
    expect(pageData.canvasSnapshot).toContain('"type":"setShadow"')
    expect(pageData.canvasSnapshot).toContain('"type":"setTextAlign"')
    expect(pageData.canvasSnapshot).toContain('"type":"setTextBaseline"')
    expect(pageData.canvasSnapshot).toContain('"type":"strokeText"')
    expect(pageData.canvasSnapshot).toContain('"fontSize":16')
    expect(pageData.canvasSnapshot).toContain('"globalAlpha":0.6')
    expect(pageData.canvasSnapshot).toContain('"lineCap":"round"')
    expect(pageData.canvasSnapshot).toContain('"lineDash":[6,3]')
    expect(pageData.canvasSnapshot).toContain('"lineDashOffset":2')
    expect(pageData.canvasSnapshot).toContain('"lineJoin":"bevel"')
    expect(pageData.canvasSnapshot).toContain('"miterLimit":6')
    expect(pageData.canvasSnapshot).toContain('"shadowBlur":4')
    expect(pageData.canvasSnapshot).toContain('"shadowColor":"#112233"')
    expect(pageData.canvasSnapshot).toContain('"textAlign":"start"')
    expect(pageData.canvasSnapshot).toContain('"textBaseline":"alphabetic"')
    expect(pageData.canvasSnapshot).toContain('"/tmp/lab-thumb.png",2,4')
    expect(pageData.canvasSnapshot).toContain('"/tmp/lab-sprite.png",0,0,24,24,8,10,12,14')
    expect(pageData.canvasSnapshot).toContain('"type":"drawImage"')
    expect(pageData.canvasTempFilePath).toContain('headless://wxfile/temp/')
    expect(pageData.canvasTempFileContent).toContain('"canvasId":"lab-canvas"')
    expect(pageData.canvasTempFileContent).toContain('"type":"fillRect"')
    expect(pageData.canvasTempFileContent).toContain('"fileType":"png"')
    expect(pageData.canvasSavedImageInfo).toContain('"errMsg":"saveImageToPhotosAlbum:ok"')
    expect(pageData.canvasSavedImageMissingInfo).toContain('"error":"saveImageToPhotosAlbum:fail file not found: headless://wxfile/temp/missing-component-lab-canvas-export.png"')
    expect(pageData.canvasImageInfo).toContain('"errMsg":"getImageInfo:ok"')
    expect(pageData.canvasImageInfo).toContain('"width":60')
    expect(pageData.canvasImageInfo).toContain('"height":40')
    expect(pageData.canvasImageInfo).toContain('"type":"png"')
    expect(pageData.canvasImageInfoMissing).toContain('"error":"getImageInfo:fail file not found: headless://wxfile/temp/missing-component-lab-canvas-image-info.png"')
    expect(pageData.previewImageInfo).toContain('"errMsg":"previewImage:ok"')
    expect(pageData.previewImageInvalidInfo).toContain('"error":"previewImage:fail invalid urls"')
    expect(pageData.chosenImageInfo).toContain('"errMsg":"chooseImage:ok"')
    expect(pageData.chosenImageInfo).toContain('headless://wxfile/temp/chosen-image-01.jpg')
    expect(pageData.chosenImageDetail).toContain('"errMsg":"getImageInfo:ok"')
    expect(pageData.chosenImageDetail).toContain('"type":"jpeg"')
    expect(pageData.chosenImageDetail).toContain('"width":160')
    expect(pageData.chosenImageDetail).toContain('"height":120')
    expect(pageData.chosenMessageFileInfo).toContain('"errMsg":"chooseMessageFile:ok"')
    expect(pageData.chosenMessageFileInfo).toContain('"name":"message-file-01.png"')
    expect(pageData.chosenMessageFileInfo).toContain('"type":"pdf"')
    expect(pageData.chosenMessageFileInfo).toContain('"type":"mp4"')
    expect(pageData.chosenMessageFileImageDetail).toContain('"errMsg":"getImageInfo:ok"')
    expect(pageData.chosenMessageFileImageDetail).toContain('"type":"png"')
    expect(pageData.chosenMessageFileImageDetail).toContain('"width":160')
    expect(pageData.chosenMessageFileVideoDetail).toContain('"errMsg":"getVideoInfo:ok"')
    expect(pageData.chosenMessageFileVideoDetail).toContain('"type":"mp4"')
    expect(pageData.chosenMessageFileVideoDetail).toContain('"duration":20')
    expect(pageData.tempFileInfo).toContain('"errMsg":"getFileInfo:ok"')
    expect(pageData.tempFileInfo).toContain('"size":23')
    expect(pageData.tempFileInfo).toContain('"digest":"9ff15fd9f0a597794a846fcacdb42538"')
    expect(pageData.savedFileDigestInfo).toContain('"errMsg":"getFileInfo:ok"')
    expect(pageData.savedFileDigestInfo).toContain('"size":23')
    expect(pageData.savedFileDigestInfo).toContain('"digest":"ae09af7f8346ddea3b2dac248fb4795cc7880ed1"')
    expect(pageData.missingFileInfo).toContain('"error":"getFileInfo:fail no such file or directory, stat \'headless://wxfile/temp/missing-file-info.txt\'"')
    expect(pageData.openDocumentInfo).toContain('"errMsg":"openDocument:ok"')
    expect(pageData.openSavedDocumentInfo).toContain('"errMsg":"openDocument:ok"')
    expect(pageData.openMissingDocumentInfo).toContain('"error":"openDocument:fail no such file or directory, open \'headless://wxfile/temp/missing-open-document.pdf\'"')
    expect(pageData.startPullDownRefreshInfo).toContain('"errMsg":"startPullDownRefresh:ok"')
    expect(pageData.pullDownRefreshInfo).toContain('"handled":true')
    expect(pageData.clipboardSetInfo).toContain('"errMsg":"setClipboardData:ok"')
    expect(pageData.clipboardReadInfo).toContain('"errMsg":"getClipboardData:ok"')
    expect(pageData.clipboardReadInfo).toContain('"data":"component-lab clipboard payload"')
    expect(pageData.loadingShownInfo).toContain('"errMsg":"showLoading:ok"')
    expect(pageData.loadingHiddenInfo).toContain('"errMsg":"hideLoading:ok"')
    expect(pageData.shareMenuShownInfo).toContain('"errMsg":"showShareMenu:ok"')
    expect(pageData.shareMenuUpdatedInfo).toContain('"errMsg":"updateShareMenu:ok"')
    expect(pageData.shareMenuHiddenInfo).toContain('"errMsg":"hideShareMenu:ok"')
    expect(pageData.modalDefaultInfo).toContain('"confirm":true')
    expect(pageData.modalDefaultInfo).toContain('"cancel":false')
    expect(pageData.modalCancelInfo).toContain('"confirm":false')
    expect(pageData.modalCancelInfo).toContain('"cancel":true')
    expect(pageData.actionSheetDefaultInfo).toContain('"tapIndex":0')
    expect(pageData.actionSheetCancelInfo).toContain('"error":"showActionSheet:fail cancel"')
    expect(pageData.tabBarHiddenInfo).toContain('"errMsg":"hideTabBar:ok"')
    expect(pageData.tabBarShownInfo).toContain('"errMsg":"showTabBar:ok"')
    expect(pageData.tabBarDotInfo).toContain('"errMsg":"showTabBarRedDot:ok"')
    expect(pageData.tabBarHideDotInfo).toContain('"errMsg":"hideTabBarRedDot:ok"')
    expect(pageData.tabBarBadgeInfo).toContain('"errMsg":"setTabBarBadge:ok"')
    expect(pageData.tabBarRemoveBadgeInfo).toContain('"errMsg":"removeTabBarBadge:ok"')
    expect(pageData.navigationBarTitleInfo).toContain('"errMsg":"setNavigationBarTitle:ok"')
    expect(pageData.navigationBarColorInfo).toContain('"errMsg":"setNavigationBarColor:ok"')
    expect(pageData.navigationBarLoadingShownInfo).toContain('"errMsg":"showNavigationBarLoading:ok"')
    expect(pageData.navigationBarLoadingHiddenInfo).toContain('"errMsg":"hideNavigationBarLoading:ok"')
    expect(pageData.backgroundLightInfo).toContain('"errMsg":"setBackgroundTextStyle:ok"')
    expect(pageData.backgroundColorInfo).toContain('"errMsg":"setBackgroundColor:ok"')
    expect(pageData.backgroundInvalidInfo).toContain('"error":"setBackgroundTextStyle:fail invalid textStyle"')
    expect(pageData.networkInitialInfo).toContain('"networkType":"wifi"')
    expect(pageData.networkCurrentInfo).toContain('"networkType":"4g"')
    expect(pageData.networkCurrentInfo).toContain('"isConnected":true')
    expect(pageData.networkLogs).toEqual([
      'get:wifi',
      'change:none:false',
      'change:4g:true',
    ])
    expect(parseJsonString(pageData.scopedComponentRect)).toEqual({
      bottom: 29,
      height: 20,
      left: 6,
      right: 36,
      top: 9,
      width: 30,
    })
    expect(parseJsonString(pageData.scopedComponentList)).toEqual([
      {
        dataset: {
          kind: 'alpha',
        },
        id: 'component-multi-a',
      },
      {
        dataset: {
          kind: 'beta',
        },
        id: 'component-multi-b',
      },
    ])
    expect(parseJsonString(pageData.scopedComponentMeta)).toEqual({
      context: {
        type: 'unsupported-context',
      },
      mark: {
        source: 'component-card',
      },
      node: {
        type: 'view',
      },
    })
    expect(pageData.compressedImageInfo).toContain('"errMsg":"compressImage:ok"')
    expect(pageData.compressedImageInfo).toContain('headless://wxfile/temp/compressed-image-')
    expect(pageData.compressedImageDetail).toContain('"errMsg":"getImageInfo:ok"')
    expect(pageData.compressedImageDetail).toContain('"type":"jpeg"')
    expect(pageData.compressedImageDetail).toContain('"width":64')
    expect(pageData.compressedImageDetail).toContain('"height":48')
    expect(pageData.compressedImageMissingInfo).toContain('"error":"compressImage:fail file not found: headless://wxfile/temp/missing-compress-image.jpg"')
    expect(pageData.chosenVideoInfo).toContain('"errMsg":"chooseVideo:ok"')
    expect(pageData.chosenVideoInfo).toContain('"duration":18')
    expect(pageData.chosenVideoInfo).toContain('"width":640')
    expect(pageData.chosenVideoInfo).toContain('"height":360')
    expect(pageData.chosenVideoSavedInfo).toContain('"errMsg":"saveVideoToPhotosAlbum:ok"')
    expect(pageData.chosenVideoMissingSaveInfo).toContain('"error":"saveVideoToPhotosAlbum:fail file not found: headless://wxfile/temp/missing-chosen-video.mp4"')
    expect(pageData.chosenVideoDetail).toContain('"errMsg":"getVideoInfo:ok"')
    expect(pageData.chosenVideoDetail).toContain('"duration":18')
    expect(pageData.chosenVideoDetail).toContain('"type":"mp4"')
    expect(pageData.chosenVideoDetailMissing).toContain('"error":"getVideoInfo:fail file not found: headless://wxfile/temp/missing-video-info.mp4"')
    expect(pageData.chosenMediaInfo).toContain('"errMsg":"chooseMedia:ok"')
    expect(pageData.chosenMediaInfo).toContain('"type":"mix"')
    expect(pageData.chosenMediaInfo).toContain('"fileType":"image"')
    expect(pageData.chosenMediaInfo).toContain('"fileType":"video"')
    expect(pageData.chosenMediaImageDetail).toContain('"errMsg":"getImageInfo:ok"')
    expect(pageData.chosenMediaImageDetail).toContain('"type":"jpeg"')
    expect(pageData.chosenMediaVideoSavedInfo).toContain('"errMsg":"saveVideoToPhotosAlbum:ok"')
    expect(pageData.chosenMediaVideoDetail).toContain('"errMsg":"getVideoInfo:ok"')
    expect(pageData.chosenMediaVideoDetail).toContain('"duration":19')
    expect(pageData.tempVideoSavedInfo).toContain('"errMsg":"saveVideoToPhotosAlbum:ok"')
    expect(pageData.tempVideoSavedMissingInfo).toContain('"error":"saveVideoToPhotosAlbum:fail file not found: headless://wxfile/temp/missing-component-lab-video.mp4"')
    expect(pageData.canvasQuerySnapshot).toContain('"canvasId":"lab-canvas"')
    expect(pageData.canvasQuerySnapshot).toContain('"type":"fillRect"')
    expect(pageData.videoContextSnapshot).toContain('"phase":"fullscreen"')
    expect(pageData.videoContextSnapshot).toContain('"currentTime":6')
    expect(pageData.videoContextSnapshot).toContain('"fullScreen":false')
    expect(pageData.directorySnapshot).toBe('["daily"]')
    expect(pageData.downloadSnapshot).toContain('"errMsg":"downloadFile:ok"')
    expect(pageData.fileTransferFailureInfo).toContain('"downloadNoMockError":"No downloadFile mock matched in headless runtime: https://mock.mpcore.dev/files/component-lab-unmatched-report.txt"')
    expect(pageData.fileTransferFailureInfo).toContain('"uploadMissingFileError":"uploadFile:fail file not found: headless://temp/component-lab-missing-upload.txt"')
    expect(pageData.fileTransferFailureInfo).toContain('"uploadNoMockError":"No uploadFile mock matched in headless runtime: https://mock.mpcore.dev/upload/component-lab-unmatched-report"')
    expect(pageData.fileManagerMissingAccessInfo).toContain('"missingAccessError":"access:fail no such file or directory')
    expect(pageData.fileManagerMissingCopyInfo).toContain('"missingCopyError":"copyFile:fail no such file or directory')
    expect(pageData.fileManagerMissingMkdirInfo).toContain('"missingMkdirError":"mkdir:fail no such file or directory')
    expect(pageData.fileManagerMissingReadInfo).toContain('"missingReadError":"readFile:fail no such file or directory')
    expect(pageData.fileManagerMissingReadDirInfo).toContain('"missingReadDirError":"readdir:fail no such file or directory')
    expect(pageData.fileManagerMissingRenameInfo).toContain('"missingRenameError":"rename:fail no such file or directory')
    expect(pageData.fileManagerMissingRmdirInfo).toContain('"missingRmdirError":"rmdir:fail no such file or directory')
    expect(pageData.fileManagerMissingStatInfo).toContain('"missingStatError":"stat:fail no such file or directory')
    expect(pageData.fileManagerMissingUnlinkInfo).toContain('"missingUnlinkError":"unlink:fail no such file or directory')
    expect(pageData.fileManagerUnsupportedAppendEncodingInfo).toContain('"unsupportedAppendEncodingError":"Unsupported file encoding in headless runtime: latin1"')
    expect(pageData.fileManagerUnsupportedReadEncodingInfo).toContain('"unsupportedReadEncodingError":"Unsupported file encoding in headless runtime: latin1"')
    expect(pageData.fileManagerUnsupportedWriteEncodingInfo).toContain('"unsupportedWriteEncodingError":"Unsupported file encoding in headless runtime: latin1"')
    expect(pageData.fileManagerSnapshot).toContain('"isDirectory":true')
    expect(pageData.fileManagerSnapshot).toContain('"isFile":true')
    expect(pageData.fileManagerSnapshot).toContain('"text":"component-lab"')
    expect(pageData.fileManagerSnapshot).toContain('"archiveRemoved":true')
    expect(pageData.requestSnapshot).toContain('"queue":"alpha"')
    expect(pageData.savedFileInfo).toContain('"errMsg":"getSavedFileInfo:ok"')
    expect(pageData.savedFileInfo).toContain('"size":20')
    expect(pageData.saveFileMissingTempInfo).toContain('"missingTempSaveError":"saveFile:fail tempFilePath not found: headless://temp/component-lab-missing-save-source.txt"')
    expect(pageData.savedCopyOverwriteInfo).toContain('"afterSize":10')
    expect(pageData.savedCopyOverwriteInfo).toContain('"filePath":"headless://saved/component-lab/copies/target.txt"')
    expect(pageData.savedOrderingInfo).toContain('"createTimesArePositive":true')
    expect(pageData.savedOrderingInfo).toContain('"headless://saved/component-lab/ordering/alpha.txt"')
    expect(pageData.savedOrderingInfo).toContain('"headless://saved/component-lab/ordering/zeta.txt"')
    expect(pageData.savedOverwriteInfo).toContain('"afterSize":14')
    expect(pageData.savedOverwriteInfo).toContain('"filePath":"headless://saved/component-lab/snapshots/report.txt"')
    expect(pageData.savedFilePath).toContain('headless://wxfile/saved/')
    expect(pageData.savedMissingInfo).toContain('"missingInfoError":"getSavedFileInfo:fail no such file or directory')
    expect(pageData.savedMissingRemovalInfo).toContain('"missingRemoveError":"removeSavedFile:fail no such file or directory')
    expect(pageData.savedPostRemovalReadInfo).toContain('"postRemovalReadError":"readFile:fail no such file or directory')
    expect(pageData.savedRenameOverwriteInfo).toContain('"afterSize":10')
    expect(pageData.savedRenameOverwriteInfo).toContain('"filePath":"headless://saved/component-lab/transfers/target.txt"')
    expect(pageData.savedRemovalInfo).toContain('"hasSavedRegistration":false')
    expect(pageData.savedRemovalInfo).toContain('"removeErrMsg":"removeSavedFile:ok"')
    expect(pageData.savedRemovalInfo).toContain('"missingInfoError":"getSavedFileInfo:fail no such file or directory')
    expect(pageData.savedRenameOutInfo).toContain('"hasSavedRegistration":false')
    expect(pageData.savedRenameOutInfo).toContain('"movedText":"rename-out"')
    expect(pageData.storageSnapshot).toContain('"status"')
    expect(pageData.toastState).toContain('showToast:ok')
    expect(pageData.uploadedSnapshot).toContain('"accepted":true')
    const savedCopyOverwriteInfo = parseJsonString<{ afterCreateTime: number, afterSize: number, beforeCreateTime: number, filePath: string }>(pageData.savedCopyOverwriteInfo)
    expect(savedCopyOverwriteInfo.afterCreateTime).toBe(savedCopyOverwriteInfo.beforeCreateTime)
    const savedRenameOverwriteInfo = parseJsonString<{ afterCreateTime: number, afterSize: number, beforeCreateTime: number, filePath: string }>(pageData.savedRenameOverwriteInfo)
    expect(savedRenameOverwriteInfo.afterCreateTime).toBe(savedRenameOverwriteInfo.beforeCreateTime)
    const savedOverwriteInfo = parseJsonString<{ afterCreateTime: number, afterSize: number, beforeCreateTime: number, filePath: string }>(pageData.savedOverwriteInfo)
    expect(savedOverwriteInfo.afterCreateTime).toBe(savedOverwriteInfo.beforeCreateTime)
    const savedOrderingInfo = parseJsonString<{ createTimesArePositive: boolean, filePaths: string[] }>(pageData.savedOrderingInfo)
    expect(savedOrderingInfo.filePaths).toEqual([
      'headless://saved/component-lab/ordering/alpha.txt',
      'headless://saved/component-lab/ordering/zeta.txt',
    ])
    expect(bridge.sessionSnapshot().openedDocument).toEqual({
      filePath: 'headless://saved/open-document/report.txt',
      fileType: 'txt',
      showMenu: false,
      visible: true,
    })
    expect(bridge.sessionSnapshot().pullDownRefreshState).toEqual({
      active: false,
      stopCalls: 1,
    })
    expect(bridge.sessionSnapshot().clipboardData).toEqual({
      data: 'component-lab clipboard payload',
    })
    expect(bridge.sessionSnapshot().loading).toBeNull()
    expect(bridge.sessionSnapshot().shareMenu).toEqual({
      isUpdatableMessage: true,
      menus: ['shareAppMessage', 'shareTimeline'],
      visible: false,
      withShareTicket: true,
    })
    expect(bridge.sessionSnapshot().modalLogs).toEqual([
      {
        cancelColor: '#000000',
        cancelText: '取消',
        confirmColor: '#576B95',
        confirmText: '确定',
        content: 'Confirm flow',
        result: {
          cancel: false,
          confirm: true,
          errMsg: 'showModal:ok',
        },
        showCancel: true,
        title: 'Warmup',
      },
      {
        cancelColor: '#000000',
        cancelText: '返回',
        confirmColor: '#576B95',
        confirmText: '继续',
        content: 'Cancel flow',
        result: {
          cancel: true,
          confirm: false,
          errMsg: 'showModal:ok',
        },
        showCancel: true,
        title: 'Blocker',
      },
    ])
    expect(bridge.sessionSnapshot().actionSheetLogs).toEqual([
      {
        itemList: ['copy', 'open'],
        result: {
          errMsg: 'showActionSheet:ok',
          tapIndex: 0,
        },
      },
      {
        itemList: ['copy', 'open'],
      },
    ])
    expect(bridge.sessionSnapshot().tabBarSnapshot).toEqual({
      items: [
        { badge: null, index: 0, pagePath: 'pages/lab/index', redDot: false, text: 'Lab' },
        { badge: null, index: 1, pagePath: 'pages/profile/index', redDot: false, text: 'Profile' },
      ],
      visible: true,
    })
    expect(bridge.sessionSnapshot().currentPageNavigationBar).toEqual({
      animation: {
        duration: 240,
        timingFunction: 'easeIn',
      },
      backgroundColor: '#135790',
      frontColor: '#ffffff',
      loading: false,
      title: 'Lab Updated',
    })
    expect(bridge.sessionSnapshot().currentPageBackground).toEqual({
      backgroundColor: '#444444',
      backgroundColorBottom: '#666666',
      backgroundColorTop: '#555555',
      textStyle: 'light',
    })
    expect(bridge.sessionSnapshot().networkType).toEqual({
      errMsg: 'getNetworkType:ok',
      networkType: '5g',
    })

    const scopeIds = bridge.findComponentScopeIds('status-card')
    expect(scopeIds).toHaveLength(1)
    expect(bridge.readScopeSnapshot(scopeIds[0])).toMatchObject({
      properties: {
        count: 3,
      },
      type: 'component',
    })
    const nestedBadgeScopeIds = bridge.findComponentScopeIds('status-card mini-badge')
    expect(nestedBadgeScopeIds).toHaveLength(1)
    expect(bridge.readScopeSnapshot(nestedBadgeScopeIds[0])).toMatchObject({
      data: {
        ping: 'ready',
      },
      properties: {
        label: 'stable',
      },
      type: 'component',
    })
    bridge.selectScope(scopeIds[0])
    const selectedComponentState = await waitFor(
      () => bridge.getState(),
      state => state.selectedScope?.scopeId === scopeIds[0],
      20_000,
    )
    expect(selectedComponentState.selectedScope).toMatchObject({
      properties: {
        count: 3,
        status: 'stable',
      },
      scopeId: scopeIds[0],
      type: 'component',
    })

    bridge.callComponentMethod(scopeIds[0], 'pulse')
    const pulsedPageState = await waitFor(
      () => parseJsonString<Record<string, any>>(bridge.getState().pageData),
      snapshot => Array.isArray(snapshot.events) && snapshot.events.includes('pulse-1') && Boolean(snapshot.eventShape),
      20_000,
    )
    expect(pulsedPageState.events).toContain('pulse-1')
    expect(parseJsonString(pulsedPageState.eventShape)).toEqual({
      bubbles: true,
      composed: true,
      dataset: {
        role: 'main',
      },
      targetId: 'status-card',
    })
    bridge.dispatchTapChain({
      activeScopeId: 'page:pages/lab/index',
      chain: [
        {
          event: {
            currentTarget: {
              dataset: {
                phase: 'inner-bind',
              },
              id: 'tap-bind-chain',
            },
            target: {
              dataset: {
                phase: 'inner-bind',
              },
              id: 'tap-bind-chain',
            },
          },
          method: 'recordTap',
          scopeId: 'page:pages/lab/index',
          stopAfter: false,
        },
        {
          event: {
            currentTarget: {
              dataset: {
                phase: 'outer-bind',
              },
              id: '',
            },
            target: {
              dataset: {
                phase: 'inner-bind',
              },
              id: 'tap-bind-chain',
            },
          },
          method: 'recordTap',
          scopeId: 'page:pages/lab/index',
          stopAfter: false,
        },
      ],
    })
    bridge.dispatchTapChain({
      activeScopeId: 'page:pages/lab/index',
      chain: [
        {
          event: {
            currentTarget: {
              dataset: {
                phase: 'inner-catch',
              },
              id: 'tap-catch-chain',
            },
            target: {
              dataset: {
                phase: 'inner-catch',
              },
              id: 'tap-catch-chain',
            },
          },
          method: 'recordTap',
          scopeId: 'page:pages/lab/index',
          stopAfter: true,
        },
      ],
    })
    const tappedPageState = await waitFor(
      () => parseJsonString<Record<string, any>>(bridge.getState().pageData),
      snapshot => Array.isArray(snapshot.tapTrail) && snapshot.tapTrail.length >= 3,
      20_000,
    )
    expect(tappedPageState.tapTrail).toEqual([
      'inner-bind',
      'outer-bind',
      'inner-catch',
    ])

    bridge.callComponentMethod(scopeIds[0], 'inspectNested')
    const nestedSnapshot = await waitFor(
      () => bridge.readScopeSnapshot(scopeIds[0]) as Record<string, any> | null,
      snapshot => Boolean(snapshot?.data?.nestedBadge),
      20_000,
    )
    expect(nestedSnapshot?.data?.nestedBadge).toContain('"label":"stable"')
    expect(nestedSnapshot?.data?.nestedBadge).toContain('"size":1')
    const intersectionSnapshot = await waitFor(
      () => bridge.readScopeSnapshot(scopeIds[0]) as Record<string, any> | null,
      snapshot => Boolean(snapshot?.data?.componentIntersectionSnapshot),
      20_000,
    )
    expect(intersectionSnapshot?.data?.componentIntersectionSnapshot).toContain('"id":"component-observer-target"')
    expect(intersectionSnapshot?.data?.componentIntersectionSnapshot).toContain('"intersectionRatio":1')
    expect(intersectionSnapshot?.data?.componentIntersectionSnapshot).toContain('"top":16')
    const initialMediaSnapshot = await waitFor(
      () => bridge.readScopeSnapshot(scopeIds[0]) as Record<string, any> | null,
      snapshot => Array.isArray(snapshot?.data?.componentMediaMatches) && snapshot.data.componentMediaMatches.length >= 1,
      20_000,
    )
    expect(initialMediaSnapshot?.data?.componentMediaMatches?.[0]).toBe(true)
    const resizedMediaSnapshot = await waitFor(
      () => bridge.readScopeSnapshot(scopeIds[0]) as Record<string, any> | null,
      snapshot => Array.isArray(snapshot?.data?.componentMediaMatches) && snapshot.data.componentMediaMatches.includes(false),
      20_000,
    )
    expect(resizedMediaSnapshot?.data?.componentMediaMatches).toContain(true)
    expect(resizedMediaSnapshot?.data?.componentMediaMatches).toContain(false)
    const videoSnapshot = await waitFor(
      () => bridge.readScopeSnapshot(scopeIds[0]) as Record<string, any> | null,
      snapshot => Array.isArray(snapshot?.data?.componentVideoLogs) && snapshot.data.componentVideoLogs.length === 4,
      20_000,
    )
    expect(videoSnapshot?.data?.componentVideoLogs).toEqual([
      'play:{"currentTime":8}',
      'pause:{"currentTime":8}',
      'fullscreen:{"currentTime":8,"fullScreen":true}',
      'fullscreen:{"currentTime":8,"fullScreen":false}',
    ])

    const sessionSnapshot = bridge.sessionSnapshot()
    expect(sessionSnapshot.directorySnapshot).toContain('headless://saved/component-lab/reports')
    expect(sessionSnapshot.directorySnapshot).toContain('headless://saved/component-lab/reports/daily')
    expect(sessionSnapshot.directorySnapshot).not.toContain('headless://saved/component-lab/archive')
    expect(sessionSnapshot.downloadFileLogs).toHaveLength(2)
    expect(sessionSnapshot.downloadFileLogs).toContainEqual(expect.objectContaining({
      matched: false,
      url: 'https://mock.mpcore.dev/files/component-lab-unmatched-report.txt',
    }))
    expect(sessionSnapshot.savedFileList).toContainEqual(expect.objectContaining({
      filePath: pageData.savedFilePath,
      size: 'component-lab report'.length,
    }))
    expect(sessionSnapshot.savedFileList).toContainEqual(expect.objectContaining({
      filePath: 'headless://saved/component-lab/copies/target.txt',
      size: 'alpha-beta'.length,
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
    expect(sessionSnapshot.savedFileList).toContainEqual(expect.objectContaining({
      filePath: 'headless://saved/component-lab/transfers/target.txt',
      size: 'alpha-beta'.length,
    }))
    expect(sessionSnapshot.savedFileList).not.toContainEqual(expect.objectContaining({
      filePath: 'headless://temp/component-lab-missing-save-source.txt',
    }))
    expect(sessionSnapshot.savedFileList).not.toContainEqual(expect.objectContaining({
      filePath: 'headless://saved/component-lab/removals/report.txt',
    }))
    expect(sessionSnapshot.savedFileList).not.toContainEqual(expect.objectContaining({
      filePath: 'headless://saved/component-lab/transfers/source.txt',
    }))
    expect(sessionSnapshot.savedFileList).not.toContainEqual(expect.objectContaining({
      filePath: 'headless://saved/component-lab/transfers/rename-out.txt',
    }))
    expect(sessionSnapshot.uploadFileLogs).toHaveLength(2)
    expect(sessionSnapshot.requestLogs).toHaveLength(1)
    expect(sessionSnapshot.requestLogs[0]).toMatchObject({
      matched: true,
      method: 'GET',
      url: 'https://mock.mpcore.dev/api/queue-health',
    })
    expect(sessionSnapshot.storageSnapshot).toEqual({
      'component-lab': {
        count: 3,
        status: 'stable',
      },
    })
    expect(sessionSnapshot.toast).toEqual({
      duration: 1500,
      icon: 'success',
      mask: false,
      title: 'status:stable',
    })
    expect(sessionSnapshot.previewImage).toEqual({
      current: pageData.canvasTempFilePath,
      urls: [
        pageData.canvasTempFilePath,
        'headless://wxfile/temp/preview-component-lab-alt.png',
      ],
      visible: true,
    })
    expect(sessionSnapshot.uploadFileLogs).toContainEqual(expect.objectContaining({
      fileContent: 'upload-no-mock',
      matched: false,
      url: 'https://mock.mpcore.dev/upload/component-lab-unmatched-report',
    }))
    expect(parseJsonString<{ timeline: string[] }>(state.appData).timeline[0]).toContain('component-lab:onLaunch:')
    expect(parseJsonString<Record<string, unknown>>(state.storageData)).toEqual(sessionSnapshot.storageSnapshot)
    expect(parseJsonString<Record<string, unknown> | null>(state.toastData)).toEqual(sessionSnapshot.toast)
    expect(parseJsonString<unknown[]>(state.requestLogData)).toEqual(sessionSnapshot.requestLogs)
    expect(Object.values(sessionSnapshot.fileSnapshot)).toContain('component-lab report')
    expect(Object.values(sessionSnapshot.fileSnapshot)).toContain('component-lab')
    expect(sessionSnapshot.fileSnapshot['headless://saved/component-lab/removals/report.txt']).toBeUndefined()
    expect(sessionSnapshot.fileSnapshot['headless://temp/component-lab-download-no-mock.txt']).toBeUndefined()
    expect(sessionSnapshot.fileSnapshot['headless://temp/component-lab-renamed.txt']).toBe('rename-out')
  })

  it('supports selector-based pageScrollTo through the web demo bridge', async () => {
    const bridge = getBridge()!
    bridge.pickScenario('commerce-shell')

    await waitFor(
      () => bridge.getState(),
      state => state.currentScenarioId === 'commerce-shell' && state.currentRoute === 'pages/home/index',
      20_000,
    )

    bridge.runPageMethod('pingSelectorScroll')

    const state = await waitFor(
      () => bridge.getState(),
      (nextState) => {
        const pageData = parseJsonString<Record<string, any>>(nextState.pageData)
        return pageData.scrollTop === 228 && Array.isArray(pageData.logs) && pageData.logs.includes('home:pageScrollTo:selector:complete')
      },
      20_000,
    )

    const pageData = parseJsonString<Record<string, any>>(state.pageData)
    expect(pageData.scrollTop).toBe(228)
    expect(pageData.logs).toContain('home:onPageScroll:{"scrollTop":228}')
    expect(pageData.logs).toContain('home:pageScrollTo:selector:success')
    expect(pageData.logs).toContain('home:pageScrollTo:selector:complete')
  })

  it('opens routes directly through the web demo bridge', async () => {
    const bridge = getBridge()!
    bridge.pickScenario('component-lab')

    await waitFor(
      () => bridge.getState(),
      state => state.currentScenarioId === 'component-lab' && state.currentRoute === 'pages/lab/index',
      20_000,
    )

    bridge.openRoute('pages/profile/index')

    const state = await waitFor(
      () => bridge.getState(),
      nextState => nextState.currentRoute === 'pages/profile/index' && nextState.pageStack.length === 1,
      20_000,
    )

    expect(state.pageStack).toEqual(['pages/profile/index'])
    expect(state.pageRoutes).toContain('pages/profile/index')
    expect(state.previewMarkup).toContain('profile')
    expect(bridge.renderCurrentPage()).toBe(state.previewMarkup)
    expect(bridge.readScopeSnapshot('page:pages/profile/index')).toMatchObject({
      data: {},
      properties: {},
      scopeId: 'page:pages/profile/index',
      type: 'page',
    })
    bridge.selectScope('page:pages/profile/index')
    const selectedPageState = await waitFor(
      () => bridge.getState(),
      nextState => nextState.selectedScope?.scopeId === 'page:pages/profile/index',
      20_000,
    )
    expect(selectedPageState.selectedScope).toMatchObject({
      data: {},
      properties: {},
      scopeId: 'page:pages/profile/index',
      type: 'page',
    })
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
    expect(parseJsonString<{ timeline: string[] }>(state.appData).timeline[0]).toContain('maze:onLaunch:')
    const queuePageData = parseJsonString<Record<string, any>>(state.pageData)
    expect(queuePageData.title).toBe('Queue')
    expect(queuePageData.from).toBe('hub')
    expect(state.previewMarkup).toContain('Queue')
    expect(bridge.renderCurrentPage()).toBe(state.previewMarkup)

    const snapshot = bridge.sessionSnapshot()
    expect(Array.isArray(snapshot.requestLogs)).toBe(true)
    expect(snapshot.pullDownRefreshState).toEqual({
      active: true,
      stopCalls: 0,
    })
    expect(snapshot.storageSnapshot).toBeTypeOf('object')
  })

  it('reports missing route navigation through the web demo bridge', async () => {
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
      state => state.currentRoute === 'package-flow/queue/index',
      20_000,
    )

    bridge.runPageMethod('openMissing')
    const state = await waitFor(
      () => bridge.getState(),
      (nextState) => {
        const pageData = parseJsonString<Record<string, any>>(nextState.pageData)
        const appData = parseJsonString<{ timeline: string[] }>(nextState.appData)
        return nextState.currentRoute === 'package-flow/queue/index'
          && Array.isArray(pageData.logs)
          && pageData.logs.includes('queue:ghost:complete')
          && appData.timeline.some(entry => entry.includes('maze:onPageNotFound:'))
      },
      20_000,
    )

    const pageData = parseJsonString<Record<string, any>>(state.pageData)
    const appData = parseJsonString<{ timeline: string[] }>(state.appData)
    expect(state.pageStack).toEqual([
      'pages/hub/index',
      'package-flow/queue/index',
    ])
    expect(pageData.logs).toContain('queue:ghost:complete')
    expect(pageData.logs.find((entry: string) => entry.startsWith('queue:ghost:')))
      .toContain('Unknown route for browser simulator navigation: ../ghost/index?from=queue')
    expect(appData.timeline.find(entry => entry.includes('maze:onPageNotFound:')))
      .toContain('"path":"package-flow/ghost/index"')
    expect(appData.timeline.find(entry => entry.includes('maze:onPageNotFound:')))
      .toContain('"from":"queue"')
  })

  it('tracks redirect navigation through the web demo bridge', async () => {
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
    await waitFor(
      () => bridge.getState(),
      state => state.currentRoute === 'package-flow/detail/index' && state.pageStack.length === 3,
      20_000,
    )

    bridge.runPageMethod('replaceInsights')
    const state = await waitFor(
      () => bridge.getState(),
      nextState => nextState.currentRoute === 'pages/insights/index' && nextState.pageStack.length === 3,
      20_000,
    )

    const pageData = parseJsonString<Record<string, any>>(state.pageData)
    expect(state.pageStack).toEqual([
      'pages/hub/index',
      'package-flow/queue/index',
      'pages/insights/index',
    ])
    expect(pageData.title).toBe('Insights')
    expect(pageData.from).toBe('detail')
    expect(state.previewMarkup).toContain('Insights')
    expect(bridge.renderCurrentPage()).toBe(state.previewMarkup)
  })

  it('tracks switchTab navigation through the web demo bridge', async () => {
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

    bridge.runPageMethod('bounceSettings')
    const state = await waitFor(
      () => bridge.getState(),
      nextState => nextState.currentRoute === 'pages/settings/index' && nextState.pageStack.length === 1,
      20_000,
    )

    const pageData = parseJsonString<Record<string, any>>(state.pageData)
    expect(state.pageStack).toEqual(['pages/settings/index'])
    expect(pageData.title).toBe('Settings Tab')
    expect(pageData.logs).toContain('settings-tab:onShow')
    expect(pageData.logs).toContain('settings-tab:onTabItemTap:{"index":1,"pagePath":"pages/settings/index","text":"Settings"}')
    expect(state.previewMarkup).toContain('Settings Tab')
    expect(bridge.renderCurrentPage()).toBe(state.previewMarkup)
  })

  it('tracks switchTab return to hub through the web demo bridge', async () => {
    const bridge = getBridge()!
    bridge.pickScenario('route-maze')

    await waitFor(
      () => bridge.getState(),
      state => state.currentScenarioId === 'route-maze' && state.currentRoute === 'pages/hub/index',
      20_000,
    )

    bridge.runPageMethod('switchSettings')
    await waitFor(
      () => bridge.getState(),
      state => state.currentRoute === 'pages/settings/index' && state.pageStack.length === 1,
      20_000,
    )

    bridge.runPageMethod('backHub')
    const state = await waitFor(
      () => bridge.getState(),
      nextState => nextState.currentRoute === 'pages/hub/index' && nextState.pageStack.length === 1,
      20_000,
    )

    const pageData = parseJsonString<Record<string, any>>(state.pageData)
    expect(state.pageStack).toEqual(['pages/hub/index'])
    expect(pageData.title).toBe('Route Maze Hub')
    expect(pageData.logs).toContain('hub:onShow')
    expect(state.previewMarkup).toContain('Route Maze Hub')
    expect(bridge.renderCurrentPage()).toBe(state.previewMarkup)
  })

  it('tracks relaunch navigation through the web demo bridge', async () => {
    const bridge = getBridge()!
    bridge.pickScenario('route-maze')

    await waitFor(
      () => bridge.getState(),
      state => state.currentScenarioId === 'route-maze' && state.currentRoute === 'pages/hub/index',
      20_000,
    )

    bridge.runPageMethod('relaunchQueue')
    const state = await waitFor(
      () => bridge.getState(),
      nextState => nextState.currentRoute === 'package-flow/queue/index' && nextState.pageStack.length === 1,
      20_000,
    )

    const pageData = parseJsonString<Record<string, any>>(state.pageData)
    expect(state.pageStack).toEqual(['package-flow/queue/index'])
    expect(pageData.title).toBe('Queue')
    expect(pageData.from).toBe('relaunch')
    expect(state.previewMarkup).toContain('Queue')
    expect(bridge.renderCurrentPage()).toBe(state.previewMarkup)
  })

  it('tracks hub-to-insights redirect flow through the web demo bridge', async () => {
    const bridge = getBridge()!
    bridge.pickScenario('route-maze')

    await waitFor(
      () => bridge.getState(),
      state => state.currentScenarioId === 'route-maze' && state.currentRoute === 'pages/hub/index',
      20_000,
    )

    bridge.runPageMethod('openInsights')
    await waitFor(
      () => bridge.getState(),
      state => state.currentRoute === 'pages/insights/index' && state.pageStack.length === 2,
      20_000,
    )

    bridge.runPageMethod('replaceToQueue')
    const state = await waitFor(
      () => bridge.getState(),
      nextState => nextState.currentRoute === 'package-flow/queue/index' && nextState.pageStack.length === 2,
      20_000,
    )

    const pageData = parseJsonString<Record<string, any>>(state.pageData)
    expect(state.pageStack).toEqual([
      'pages/hub/index',
      'package-flow/queue/index',
    ])
    expect(pageData.title).toBe('Queue')
    expect(pageData.from).toBe('insights')
    expect(state.previewMarkup).toContain('Queue')
    expect(bridge.renderCurrentPage()).toBe(state.previewMarkup)
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
