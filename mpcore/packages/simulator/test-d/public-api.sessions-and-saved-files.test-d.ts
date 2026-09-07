import type {
  BrowserHeadlessSession,
  HeadlessPluginDescriptor,
  HeadlessSession,
  HeadlessTestingPageHandle,
  HeadlessTestingRenderedNodeSnapshot,
  HeadlessTestingSessionHandle,
  HeadlessTestingToolInfo,
  HeadlessWx,
  HeadlessWxAppHideCallback,
  HeadlessWxAppHideOptions,
  HeadlessWxAppShowCallback,
  HeadlessWxDeviceInfoResult,
  HeadlessWxDownloadFileMockDefinition,
  HeadlessWxGetLocationResult,
  HeadlessWxIntersectionObserver,
  HeadlessWxLaunchOptions,
  HeadlessWxMediaQueryObserver,
  HeadlessWxUploadFileMockDefinition,
} from '..'
import { expectError, expectType } from 'tsd'
import {
  createBrowserHeadlessSession,
  createBrowserVirtualFiles,
  createHeadlessSession,
  launch,
} from '..'

const browserFiles = createBrowserVirtualFiles([
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({})'],
  ['pages/index/index.js', 'Page({})'],
  ['pages/index/index.wxml', '<view>hello</view>'],
])

const appShowOptions: HeadlessWxLaunchOptions = {
  path: 'pages/index/index',
  query: { from: 'resume' },
  referrerInfo: {
    appId: '',
    extraData: {},
  },
  scene: 1001,
}
const appHideOptions: HeadlessWxAppHideOptions = { reason: 3 }
const appShowCallback: HeadlessWxAppShowCallback = (options) => {
  expectType<HeadlessWxLaunchOptions>(options)
}
const appHideCallback: HeadlessWxAppHideCallback = (options) => {
  expectType<HeadlessWxAppHideOptions>(options)
}

const browserSession = createBrowserHeadlessSession({ files: browserFiles })
expectType<HeadlessPluginDescriptor[]>(browserSession.project.plugins)
expectType<BrowserHeadlessSession>(createBrowserHeadlessSession({
  files: browserFiles,
  onRender: () => {},
  strictHostMocks: true,
}))
expectType<HeadlessSession>(createHeadlessSession({
  projectPath: 'fixture-project',
  strictHostMocks: true,
}))
browserSession.reLaunch('/pages/index/index')
expectType<void>(browserSession.triggerAppShow())
expectType<void>(browserSession.triggerAppShow(appShowOptions))
expectType<void>(browserSession.triggerAppHide(appHideOptions))
expectError(browserSession.triggerAppHide())
expectError(browserSession.triggerAppHide({ reason: 4 }))
const browserPage = browserSession.getCurrentPages()[0]
declare const browserWx: HeadlessWx
expectType<void>(browserWx.onAppShow(appShowCallback))
expectType<void>(browserWx.offAppShow(appShowCallback))
expectType<void>(browserWx.offAppShow())
expectType<void>(browserWx.onAppHide(appHideCallback))
expectType<void>(browserWx.offAppHide(appHideCallback))
expectType<void>(browserWx.offAppHide())

expectType<void>(browserSession.mockDownloadFile({
  fileContent: (option) => {
    expectType<string>(option.url)
    return option.filePath ?? 'headless://wxfile/temp/browser-report.txt'
  },
  url: 'https://mock.mpcore.dev/files/report.txt',
}))
expectType<void>(browserSession.mockUploadFile({
  response: (option) => {
    expectType<string>(option.fileContent)
    expectType<string>(option.name)
    return {
      data: option.fileContent,
      statusCode: 201,
    }
  },
  url: 'https://mock.mpcore.dev/upload/report',
}))
expectType<{ errMsg: string, tempFilePath: string } | undefined>(browserWx.canvasToTempFilePath({
  canvasId: 'hero-canvas',
  component: browserPage,
  destHeight: 40,
  destWidth: 60,
  fileType: 'png',
  height: 20,
  quality: 1,
  width: 30,
  x: 1,
  y: 2,
}))
expectType<{
  actions: Array<{
    animates: Array<{ args: unknown[], type: string }>
    option: {
      delay: number
      duration: number
      timingFunction: 'ease' | 'ease-in' | 'ease-in-out' | 'ease-out' | 'linear' | 'step-end' | 'step-start'
      transformOrigin: string
    }
  }>
}>(browserWx.createAnimation({
  duration: 120,
}).opacity(0.4).step().export())
expectType<{
  __getSnapshot: () => {
    canvasId: string
    drawCalls: Array<{ args: unknown[], type: string }>
    fillStyle: string
    fontSize: number
    globalAlpha: number
    lineCap: string
    lineDash: number[]
    lineDashOffset: number
    lineJoin: string
    miterLimit: number
    lineWidth: number
    reserve: boolean
    shadowBlur: number
    shadowColor: string
    shadowOffsetX: number
    shadowOffsetY: number
    strokeStyle: string
    textAlign: string
    textBaseline: string
  }
  arc: (x: number, y: number, r: number, sAngle: number, eAngle: number, counterclockwise?: boolean) => void
  arcTo: (x1: number, y1: number, x2: number, y2: number, radius: number) => void
  bezierCurveTo: (cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) => void
  beginPath: () => void
  clearRect: (x: number, y: number, width: number, height: number) => void
  clip: (fillRule?: string) => void
  closePath: () => void
  draw: (reserve?: boolean, callback?: () => void) => void
  drawImage: (image: string, ...args: number[]) => void
  fill: (fillRule?: string) => void
  fillRect: (x: number, y: number, width: number, height: number) => void
  fillText: (text: string, x: number, y: number, maxWidth?: number) => void
  lineTo: (x: number, y: number) => void
  measureText: (text: string) => { width: number }
  moveTo: (x: number, y: number) => void
  quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) => void
  rect: (x: number, y: number, width: number, height: number) => void
  restore: () => void
  rotate: (rotate: number) => void
  save: () => void
  scale: (scaleWidth: number, scaleHeight: number) => void
  setFillStyle: (value: string) => void
  setFontSize: (fontSize: number) => void
  setGlobalAlpha: (value: number) => void
  setLineCap: (value: string) => void
  setLineDash: (pattern: number[], offset?: number) => void
  setLineJoin: (value: string) => void
  setMiterLimit: (value: number) => void
  setLineWidth: (value: number) => void
  setShadow: (offsetX: number, offsetY: number, blur: number, color: string) => void
  setStrokeStyle: (value: string) => void
  setTextAlign: (value: string) => void
  setTextBaseline: (value: string) => void
  stroke: () => void
  strokeRect: (x: number, y: number, width: number, height: number) => void
  strokeText: (text: string, x: number, y: number, maxWidth?: number) => void
  translate: (x: number, y: number) => void
}>(browserWx.createCanvasContext('hero-canvas', browserPage))
browserWx.createCanvasContext('hero-canvas', browserPage).arc(10, 12, 6, 0, Math.PI, false)
browserWx.createCanvasContext('hero-canvas', browserPage).arcTo(18, 6, 24, 12, 4)
browserWx.createCanvasContext('hero-canvas', browserPage).bezierCurveTo(10, 4, 14, 8, 18, 12)
browserWx.createCanvasContext('hero-canvas', browserPage).clip('evenodd')
browserWx.createCanvasContext('hero-canvas', browserPage).closePath()
browserWx.createCanvasContext('hero-canvas', browserPage).drawImage('/tmp/thumb.png', 2, 4)
browserWx.createCanvasContext('hero-canvas', browserPage).drawImage('/tmp/report.png', 4, 6, 12, 8)
browserWx.createCanvasContext('hero-canvas', browserPage).drawImage('/tmp/sprite.png', 0, 0, 24, 24, 8, 10, 12, 14)
browserWx.createCanvasContext('hero-canvas', browserPage).rect(2, 3, 16, 10)
browserWx.createCanvasContext('hero-canvas', browserPage).quadraticCurveTo(8, 4, 12, 16)
browserWx.createCanvasContext('hero-canvas', browserPage).restore()
browserWx.createCanvasContext('hero-canvas', browserPage).rotate(0.5)
browserWx.createCanvasContext('hero-canvas', browserPage).save()
browserWx.createCanvasContext('hero-canvas', browserPage).scale(1.2, 0.8)
browserWx.createCanvasContext('hero-canvas', browserPage).setGlobalAlpha(0.6)
browserWx.createCanvasContext('hero-canvas', browserPage).setLineCap('round')
browserWx.createCanvasContext('hero-canvas', browserPage).setLineDash([6, 3], 2)
browserWx.createCanvasContext('hero-canvas', browserPage).setLineJoin('bevel')
browserWx.createCanvasContext('hero-canvas', browserPage).setMiterLimit(6)
browserWx.createCanvasContext('hero-canvas', browserPage).setShadow(2, 3, 4, '#112233')
browserWx.createCanvasContext('hero-canvas', browserPage).fill('evenodd')
browserWx.createCanvasContext('hero-canvas', browserPage).setTextAlign('center')
browserWx.createCanvasContext('hero-canvas', browserPage).setTextBaseline('middle')
browserWx.createCanvasContext('hero-canvas', browserPage).strokeText('canvas', 6, 20)
browserWx.createCanvasContext('hero-canvas', browserPage).translate(3, 4)

expectType<string | null>(browserSession.getCurrentPageNavigationBarTitle())
expectType<HeadlessWxDeviceInfoResult>(browserSession.getDeviceInfo())
expectType<HeadlessWxDeviceInfoResult>(browserWx.getDeviceInfo())
expectType<HeadlessWxGetLocationResult>(browserSession.getLocation())
expectType<HeadlessWxGetLocationResult | undefined>(browserWx.getLocation({
  isHighAccuracy: true,
  type: 'gcj02',
}))
expectType<{ active: boolean, stopCalls: number }>(browserSession.getPullDownRefreshState())
expectType<{ data: string }>(browserSession.getClipboardData())
expectType<{ mask: boolean, title: string } | null>(browserSession.getLoading())
expectType<{ visible: boolean }>(browserSession.getTabBar())
expectType<Record<string, string>>(browserSession.getFileSnapshot())
expectType<Array<{ createTime: number, filePath: string, size: number }>>(browserSession.getSavedFileListSnapshot())
expectType<string | null>(browserSession.getFileText('headless://wxfile/temp/0001'))
expectType<{ filePath: string, fileType: string, showMenu: boolean, visible: boolean } | null>(browserSession.getOpenedDocument())
expectType<HeadlessWxIntersectionObserver>(browserWx.createIntersectionObserver(browserPage, { thresholds: [0, 1] }))
expectType<HeadlessWxMediaQueryObserver | undefined>(browserPage?.createMediaQueryObserver?.())
expectType<{
  exitFullScreen: () => void
  pause: () => void
  play: () => void
  requestFullScreen: () => void
  seek: (position: number) => void
  stop: () => void
}>(browserWx.createVideoContext('hero-video', browserPage))
expectType<{ createTime: number, errMsg: string, size: number } | undefined>(browserWx.getSavedFileInfo({ filePath: 'headless://wxfile/saved/0001' }))
expectType<{ errMsg: string, fileList: Array<{ createTime: number, filePath: string, size: number }> } | undefined>(browserWx.getSavedFileList())
expectType<{ digest: string, errMsg: string, size: number } | undefined>(browserWx.getFileInfo({
  digestAlgorithm: 'md5',
  filePath: 'headless://wxfile/temp/0001',
}))
expectType<{ errMsg: string } | undefined>(browserWx.openDocument({
  filePath: 'headless://wxfile/temp/0001.pdf',
  fileType: 'pdf',
  showMenu: true,
}))
expectType<{ errMsg: string } | undefined>(browserWx.startPullDownRefresh())
expectType<{ errMsg: string } | undefined>(browserWx.setClipboardData({
  data: 'clipboard',
}))
expectType<{ data: string, errMsg: string } | undefined>(browserWx.getClipboardData())
expectType<{ errMsg: string } | undefined>(browserWx.showLoading({
  mask: true,
  title: 'loading',
}))
expectType<{ errMsg: string } | undefined>(browserWx.hideLoading())
expectType<{ errMsg: string } | undefined>(browserWx.saveImageToPhotosAlbum({
  filePath: 'headless://wxfile/temp/0001',
}))
expectType<{ errMsg: string } | undefined>(browserWx.saveVideoToPhotosAlbum({
  filePath: 'headless://wxfile/temp/0001',
}))
expectType<{
  errMsg: string
  height: number
  orientation: 'up'
  path: string
  type: string
  width: number
} | undefined>(browserWx.getImageInfo({
  src: 'headless://wxfile/temp/0001',
}))
expectType<{
  bitrate: number
  duration: number
  errMsg: string
  fps: number
  height: number
  orientation: 'up'
  size: number
  type: string
  width: number
} | undefined>(browserWx.getVideoInfo({
  src: 'headless://wxfile/temp/0001.mp4',
}))
expectType<{ errMsg: string } | undefined>(browserWx.previewImage({
  current: 'headless://wxfile/temp/0001',
  urls: ['headless://wxfile/temp/0001'],
}))
expectType<{
  errMsg: string
  tempFilePaths: string[]
  tempFiles: Array<{ path: string, size: number }>
} | undefined>(browserWx.chooseImage({
  count: 2,
  sizeType: ['compressed'],
  sourceType: ['album'],
}))
expectType<{
  errMsg: string
  tempFiles: Array<{
    name: string
    path: string
    size: number
    time: number
    type: string
  }>
} | undefined>(browserWx.chooseMessageFile({
  count: 3,
  extension: ['png', 'pdf', 'mp4'],
  type: 'all',
}))
expectType<{
  duration: number
  errMsg: string
  height: number
  size: number
  tempFilePath: string
  width: number
} | undefined>(browserWx.chooseVideo({
  compressed: true,
  maxDuration: 24,
  sourceType: ['album'],
}))
expectType<{
  errMsg: string
  tempFiles: Array<{
    duration?: number
    fileType: 'image' | 'video'
    height: number
    size: number
    tempFilePath: string
    thumbTempFilePath?: string
    width: number
  }>
  type: 'image' | 'mix' | 'video'
} | undefined>(browserWx.chooseMedia({
  count: 2,
  maxDuration: 24,
  mediaType: ['image', 'video'],
  sizeType: ['compressed'],
  sourceType: ['album'],
}))
expectType<{
  errMsg: string
  tempFilePath: string
} | undefined>(browserWx.compressImage({
  compressedHeight: 48,
  compressedWidth: 64,
  quality: 70,
  src: 'headless://wxfile/temp/0001.jpg',
}))
expectType<{ abort: () => void }>(browserWx.downloadFile({
  url: 'https://mock.mpcore.dev/files/report.txt',
  success: (result) => {
    expectType<{ errMsg: string, statusCode: number, tempFilePath: string }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ errMsg: string, statusCode: number, tempFilePath: string } | undefined>(result)
  },
}) ?? { abort() {} })
expectType<{ abort: () => void }>(browserWx.uploadFile({
  url: 'https://mock.mpcore.dev/upload/report',
  filePath: 'headless://wxfile/temp/0001',
  name: 'report',
  success: (result) => {
    expectType<{ data: string, errMsg: string, statusCode: number }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ data: string, errMsg: string, statusCode: number } | undefined>(result)
  },
}) ?? { abort() {} })

browserWx.saveFile({
  tempFilePath: 'headless://wxfile/temp/0001',
  success: (result) => {
    expectType<{ errMsg: string, savedFilePath: string }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ errMsg: string, savedFilePath: string } | undefined>(result)
  },
})

browserWx.getSavedFileList({
  success: (result) => {
    expectType<{ errMsg: string, fileList: Array<{ createTime: number, filePath: string, size: number }> }>(result)
  },
  complete: (result) => {
    expectType<{ errMsg: string, fileList: Array<{ createTime: number, filePath: string, size: number }> } | undefined>(result)
  },
})

browserWx.getSavedFileInfo({
  filePath: 'headless://wxfile/saved/0001',
  success: (result) => {
    expectType<{ createTime: number, errMsg: string, size: number }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ createTime: number, errMsg: string, size: number } | undefined>(result)
  },
})

browserWx.removeSavedFile({
  filePath: 'headless://wxfile/saved/0001',
  success: (result) => {
    expectType<{ errMsg: string }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ errMsg: string } | undefined>(result)
  },
})

const headlessSession = createHeadlessSession({ projectPath: 'fixture-project' })
const headlessPage = headlessSession.getCurrentPages()[0]
const headlessWx = headlessSession.getWx()
expectType<void>(headlessSession.triggerAppShow())
expectType<void>(headlessSession.triggerAppShow(appShowOptions))
expectType<void>(headlessSession.triggerAppHide(appHideOptions))
expectError(headlessSession.triggerAppHide())
expectError(headlessSession.triggerAppHide({ reason: 4 }))

expectType<{ errMsg: string } | undefined>(headlessWx.loadFontFace({
  family: 'uview-icon',
  source: 'url("headless://font/uview.ttf")',
  success: (result) => {
    expectType<{ errMsg: string }>(result)
  },
}))
expectType<void>(headlessWx.$on('grid:update', (index: number) => {
  expectType<number>(index)
}))
expectType<void>(headlessWx.$once('grid:update', () => {}))
expectType<void>(headlessWx.$emit('grid:update', 1))
expectType<void>(headlessWx.$off('grid:update'))
expectType<string>(headlessWx.getLocale())
expectType<number>(headlessWx.rpx2px(100))
expectType<number>(headlessWx.upx2px(100))
expectType<number | undefined>(headlessWx.getWindowInfo()?.safeAreaInsets.bottom)

const headlessDownloadMock: HeadlessWxDownloadFileMockDefinition = {
  fileContent: 'downloaded report',
  url: /report\.txt$/,
}
expectType<void>(headlessSession.mockDownloadFile(headlessDownloadMock))

const headlessUploadMock: HeadlessWxUploadFileMockDefinition = {
  response: (option) => {
    expectType<string>(option.fileContent)
    expectType<Record<string, unknown>>(option.formData ?? {})
    return JSON.stringify({
      accepted: true,
      filePath: option.filePath,
    })
  },
  url: /upload\/report$/,
}
expectType<void>(headlessSession.mockUploadFile(headlessUploadMock))
expectType<{
  actions: Array<{
    animates: Array<{ args: unknown[], type: string }>
    option: {
      delay: number
      duration: number
      timingFunction: 'ease' | 'ease-in' | 'ease-in-out' | 'ease-out' | 'linear' | 'step-end' | 'step-start'
      transformOrigin: string
    }
  }>
}>(headlessWx.createAnimation({
  duration: 120,
}).translateX(12).step().export())
expectType<{
  __getSnapshot: () => {
    canvasId: string
    drawCalls: Array<{ args: unknown[], type: string }>
    fillStyle: string
    fontSize: number
    lineCap: string
    lineJoin: string
    miterLimit: number
    lineWidth: number
    reserve: boolean
    shadowBlur: number
    shadowColor: string
    shadowOffsetX: number
    shadowOffsetY: number
    strokeStyle: string
    textAlign: string
    globalAlpha: number
    lineDash: number[]
    lineDashOffset: number
    textBaseline: string
  }
  arc: (x: number, y: number, r: number, sAngle: number, eAngle: number, counterclockwise?: boolean) => void
  arcTo: (x1: number, y1: number, x2: number, y2: number, radius: number) => void
  bezierCurveTo: (cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) => void
  beginPath: () => void
  clearRect: (x: number, y: number, width: number, height: number) => void
  clip: (fillRule?: string) => void
  closePath: () => void
  draw: (reserve?: boolean, callback?: () => void) => void
  drawImage: (image: string, ...args: number[]) => void
  fill: (fillRule?: string) => void
  fillRect: (x: number, y: number, width: number, height: number) => void
  fillText: (text: string, x: number, y: number, maxWidth?: number) => void
  lineTo: (x: number, y: number) => void
  measureText: (text: string) => { width: number }
  moveTo: (x: number, y: number) => void
  quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) => void
  rect: (x: number, y: number, width: number, height: number) => void
  restore: () => void
  rotate: (rotate: number) => void
  save: () => void
  scale: (scaleWidth: number, scaleHeight: number) => void
  setFillStyle: (value: string) => void
  setFontSize: (fontSize: number) => void
  setGlobalAlpha: (value: number) => void
  setLineCap: (value: string) => void
  setLineDash: (pattern: number[], offset?: number) => void
  setLineJoin: (value: string) => void
  setMiterLimit: (value: number) => void
  setLineWidth: (value: number) => void
  setShadow: (offsetX: number, offsetY: number, blur: number, color: string) => void
  setStrokeStyle: (value: string) => void
  setTextAlign: (value: string) => void
  setTextBaseline: (value: string) => void
  stroke: () => void
  strokeRect: (x: number, y: number, width: number, height: number) => void
  strokeText: (text: string, x: number, y: number, maxWidth?: number) => void
  translate: (x: number, y: number) => void
}>(headlessWx.createCanvasContext('hero-canvas', headlessPage))
headlessWx.createCanvasContext('hero-canvas', headlessPage).arc(10, 12, 6, 0, Math.PI, false)
headlessWx.createCanvasContext('hero-canvas', headlessPage).arcTo(18, 6, 24, 12, 4)
headlessWx.createCanvasContext('hero-canvas', headlessPage).bezierCurveTo(10, 4, 14, 8, 18, 12)
headlessWx.createCanvasContext('hero-canvas', headlessPage).clip('evenodd')
headlessWx.createCanvasContext('hero-canvas', headlessPage).closePath()
headlessWx.createCanvasContext('hero-canvas', headlessPage).drawImage('/tmp/thumb.png', 2, 4)
headlessWx.createCanvasContext('hero-canvas', headlessPage).drawImage('/tmp/report.png', 4, 6, 12, 8)
headlessWx.createCanvasContext('hero-canvas', headlessPage).drawImage('/tmp/sprite.png', 0, 0, 24, 24, 8, 10, 12, 14)
headlessWx.createCanvasContext('hero-canvas', headlessPage).rect(2, 3, 16, 10)
headlessWx.createCanvasContext('hero-canvas', headlessPage).quadraticCurveTo(8, 4, 12, 16)
headlessWx.createCanvasContext('hero-canvas', headlessPage).restore()
headlessWx.createCanvasContext('hero-canvas', headlessPage).rotate(0.5)
headlessWx.createCanvasContext('hero-canvas', headlessPage).save()
headlessWx.createCanvasContext('hero-canvas', headlessPage).scale(1.2, 0.8)
headlessWx.createCanvasContext('hero-canvas', headlessPage).setGlobalAlpha(0.6)
headlessWx.createCanvasContext('hero-canvas', headlessPage).setLineCap('round')
headlessWx.createCanvasContext('hero-canvas', headlessPage).setLineDash([6, 3], 2)
headlessWx.createCanvasContext('hero-canvas', headlessPage).setLineJoin('bevel')
headlessWx.createCanvasContext('hero-canvas', headlessPage).setMiterLimit(6)
headlessWx.createCanvasContext('hero-canvas', headlessPage).setShadow(2, 3, 4, '#112233')
headlessWx.createCanvasContext('hero-canvas', headlessPage).fill('evenodd')
headlessWx.createCanvasContext('hero-canvas', headlessPage).setTextAlign('center')
headlessWx.createCanvasContext('hero-canvas', headlessPage).setTextBaseline('middle')
headlessWx.createCanvasContext('hero-canvas', headlessPage).strokeText('canvas', 6, 20)
headlessWx.createCanvasContext('hero-canvas', headlessPage).translate(3, 4)

expectType<{ active: boolean, stopCalls: number }>(headlessSession.getPullDownRefreshState())
expectType<{ data: string }>(headlessSession.getClipboardData())
expectType<{ mask: boolean, title: string } | null>(headlessSession.getLoading())
expectType<{ visible: boolean }>(headlessSession.getTabBar())
expectType<Record<string, string>>(headlessSession.getFileSnapshot())
expectType<Array<{ createTime: number, filePath: string, size: number }>>(headlessSession.getSavedFileListSnapshot())
expectType<string | null>(headlessSession.getFileText('headless://wxfile/temp/0001'))
expectType<{ filePath: string, fileType: string, showMenu: boolean, visible: boolean } | null>(headlessSession.getOpenedDocument())
expectType<{ errMsg: string, tempFilePath: string } | undefined>(headlessWx.canvasToTempFilePath({
  canvasId: 'hero-canvas',
  component: headlessPage,
  destHeight: 40,
  destWidth: 60,
  fileType: 'png',
  height: 20,
  quality: 1,
  width: 30,
  x: 1,
  y: 2,
}))
expectType<HeadlessWxIntersectionObserver>(headlessWx.createIntersectionObserver(headlessPage, { thresholds: [0, 1] }))
expectType<HeadlessWxMediaQueryObserver | undefined>(headlessPage?.createMediaQueryObserver?.())
expectType<{
  exitFullScreen: () => void
  pause: () => void
  play: () => void
  requestFullScreen: () => void
  seek: (position: number) => void
  stop: () => void
}>(headlessWx.createVideoContext('hero-video', headlessPage))
expectType<{ createTime: number, errMsg: string, size: number } | undefined>(headlessWx.getSavedFileInfo({ filePath: 'headless://wxfile/saved/0001' }))
expectType<{ errMsg: string, fileList: Array<{ createTime: number, filePath: string, size: number }> } | undefined>(headlessWx.getSavedFileList())
expectType<{ digest: string, errMsg: string, size: number } | undefined>(headlessWx.getFileInfo({
  digestAlgorithm: 'sha1',
  filePath: 'headless://wxfile/temp/0001',
}))
expectType<{ errMsg: string } | undefined>(headlessWx.openDocument({
  filePath: 'headless://wxfile/temp/0001.txt',
  showMenu: false,
}))
expectType<{ errMsg: string } | undefined>(headlessWx.startPullDownRefresh())
expectType<{ errMsg: string } | undefined>(headlessWx.setClipboardData({
  data: 'clipboard',
}))
expectType<{ data: string, errMsg: string } | undefined>(headlessWx.getClipboardData())
expectType<{ errMsg: string } | undefined>(headlessWx.showLoading({
  mask: false,
  title: 'loading',
}))
expectType<{ errMsg: string } | undefined>(headlessWx.hideLoading())
expectType<{ errMsg: string } | undefined>(headlessWx.saveImageToPhotosAlbum({
  filePath: 'headless://wxfile/temp/0001',
}))
expectType<{ errMsg: string } | undefined>(headlessWx.saveVideoToPhotosAlbum({
  filePath: 'headless://wxfile/temp/0001',
}))
expectType<{
  errMsg: string
  height: number
  orientation: 'up'
  path: string
  type: string
  width: number
} | undefined>(headlessWx.getImageInfo({
  src: 'headless://wxfile/temp/0001',
}))
expectType<{
  bitrate: number
  duration: number
  errMsg: string
  fps: number
  height: number
  orientation: 'up'
  size: number
  type: string
  width: number
} | undefined>(headlessWx.getVideoInfo({
  src: 'headless://wxfile/temp/0001.mp4',
}))
expectType<{ errMsg: string } | undefined>(headlessWx.previewImage({
  current: 'headless://wxfile/temp/0001',
  urls: ['headless://wxfile/temp/0001'],
}))
expectType<{
  errMsg: string
  tempFilePaths: string[]
  tempFiles: Array<{ path: string, size: number }>
} | undefined>(headlessWx.chooseImage({
  count: 2,
  sizeType: ['compressed'],
  sourceType: ['album'],
}))
expectType<{
  errMsg: string
  tempFiles: Array<{
    name: string
    path: string
    size: number
    time: number
    type: string
  }>
} | undefined>(headlessWx.chooseMessageFile({
  count: 3,
  extension: ['png', 'pdf', 'mp4'],
  type: 'all',
}))
expectType<{
  duration: number
  errMsg: string
  height: number
  size: number
  tempFilePath: string
  width: number
} | undefined>(headlessWx.chooseVideo({
  compressed: true,
  maxDuration: 24,
  sourceType: ['album'],
}))
expectType<{
  errMsg: string
  tempFiles: Array<{
    duration?: number
    fileType: 'image' | 'video'
    height: number
    size: number
    tempFilePath: string
    thumbTempFilePath?: string
    width: number
  }>
  type: 'image' | 'mix' | 'video'
} | undefined>(headlessWx.chooseMedia({
  count: 2,
  maxDuration: 24,
  mediaType: ['image', 'video'],
  sizeType: ['compressed'],
  sourceType: ['album'],
}))
expectType<{
  errMsg: string
  tempFilePath: string
} | undefined>(headlessWx.compressImage({
  compressedHeight: 48,
  compressedWidth: 64,
  quality: 70,
  src: 'headless://wxfile/temp/0001.jpg',
}))
expectType<{ abort: () => void }>(headlessWx.downloadFile({
  url: 'https://mock.mpcore.dev/files/report.txt',
  success: (result) => {
    expectType<{ errMsg: string, statusCode: number, tempFilePath: string }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ errMsg: string, statusCode: number, tempFilePath: string } | undefined>(result)
  },
}) ?? { abort() {} })
expectType<{ abort: () => void }>(headlessWx.uploadFile({
  url: 'https://mock.mpcore.dev/upload/report',
  filePath: 'headless://wxfile/temp/0001',
  name: 'report',
  success: (result) => {
    expectType<{ data: string, errMsg: string, statusCode: number }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ data: string, errMsg: string, statusCode: number } | undefined>(result)
  },
}) ?? { abort() {} })

headlessWx.saveFile({
  tempFilePath: 'headless://wxfile/temp/0001',
  success: (result) => {
    expectType<{ errMsg: string, savedFilePath: string }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ errMsg: string, savedFilePath: string } | undefined>(result)
  },
})

headlessWx.getSavedFileList({
  success: (result) => {
    expectType<{ errMsg: string, fileList: Array<{ createTime: number, filePath: string, size: number }> }>(result)
  },
  complete: (result) => {
    expectType<{ errMsg: string, fileList: Array<{ createTime: number, filePath: string, size: number }> } | undefined>(result)
  },
})

headlessWx.getSavedFileInfo({
  filePath: 'headless://wxfile/saved/0001',
  success: (result) => {
    expectType<{ createTime: number, errMsg: string, size: number }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ createTime: number, errMsg: string, size: number } | undefined>(result)
  },
})

headlessWx.removeSavedFile({
  filePath: 'headless://wxfile/saved/0001',
  success: (result) => {
    expectType<{ errMsg: string }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ errMsg: string } | undefined>(result)
  },
})

const launchResult = launch({ projectPath: 'fixture-project' })
launchResult.then((session) => {
  expectType<Promise<unknown>>(session.callWxMethod('getStorageSync', 'probe'))
  expectType<Promise<unknown>>(session.callWxMethodWithOptions('getStorageSync', {
    timeout: 1_000,
  }, 'probe'))
  expectType<Promise<number>>(session.evaluate(() => 42))
  expectType<Promise<string>>(session.evaluateWithOptions('(value) => String(value)', {
    timeout: 1_000,
  }, 'probe'))
  expectType<HeadlessTestingSessionHandle>(session.on('console', () => {}))
  expectType<HeadlessTestingSessionHandle>(session.removeListener('console', () => {}))
  expectType<HeadlessTestingSessionHandle>(session.off('console', () => {}))
  expectType<Promise<HeadlessTestingToolInfo>>(session.toolInfo())
  expectType<Promise<void>>(session.triggerAppShow())
  expectType<Promise<void>>(session.triggerAppShow(appShowOptions))
  expectType<Promise<void>>(session.triggerAppHide(appHideOptions))
  expectError(session.triggerAppHide())
  expectError(session.triggerAppHide({ reason: 4 }))
  session.toolInfo().then(info => expectType<'mpcore-simulator'>(info.version))
  session.reLaunch('/pages/index/index').then((page) => {
    expectType<string>(page.path)
    expectType<Record<string, string>>(page.query)
    page.callMethodWithOptions('runProbe', {
      fallback: false,
      routeOnly: true,
      timeout: 1_000,
    })
    expectType<Promise<HeadlessTestingRenderedNodeSnapshot[]>>(page.renderedNodes('#probe'))
    expectType<Promise<string>>(page.waitForRendered({
      dataset: { status: 'ready' },
      selector: '#probe',
    }))
  })
  expectType<Promise<HeadlessTestingPageHandle>>(session.navigateTo('/pages/detail/index'))
  expectType<Promise<HeadlessTestingPageHandle>>(session.redirectTo('/pages/detail/index'))
  expectType<Promise<HeadlessTestingPageHandle | null>>(session.navigateBack())
  expectType<Promise<HeadlessTestingPageHandle>>(session.switchTab('/pages/profile/index'))
})
expectType<Promise<HeadlessTestingSessionHandle>>(launchResult)
