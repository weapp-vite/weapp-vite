import type {
  HeadlessWxDownloadFileMockDefinition,
  HeadlessWxUploadFileMockDefinition,
} from '..'
import { expectType } from 'tsd'
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

const browserSession = createBrowserHeadlessSession({ files: browserFiles })
browserSession.reLaunch('/pages/index/index')
const browserPage = browserSession.getCurrentPages()[0]

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
expectType<{
  errMsg: string
  tempFilePath: string
}>(browserPage?.wx.canvasToTempFilePath({
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
}>(browserPage?.wx.createAnimation({
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
}>(browserPage?.wx.createCanvasContext('hero-canvas', browserPage))
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).arc(10, 12, 6, 0, Math.PI, false)
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).arcTo(18, 6, 24, 12, 4)
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).bezierCurveTo(10, 4, 14, 8, 18, 12)
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).clip('evenodd')
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).closePath()
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).drawImage('/tmp/thumb.png', 2, 4)
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).drawImage('/tmp/report.png', 4, 6, 12, 8)
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).drawImage('/tmp/sprite.png', 0, 0, 24, 24, 8, 10, 12, 14)
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).rect(2, 3, 16, 10)
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).quadraticCurveTo(8, 4, 12, 16)
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).restore()
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).rotate(0.5)
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).save()
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).scale(1.2, 0.8)
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).setGlobalAlpha(0.6)
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).setLineCap('round')
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).setLineDash([6, 3], 2)
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).setLineJoin('bevel')
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).setMiterLimit(6)
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).setShadow(2, 3, 4, '#112233')
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).fill('evenodd')
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).setTextAlign('center')
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).setTextBaseline('middle')
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).strokeText('canvas', 6, 20)
browserPage?.wx.createCanvasContext('hero-canvas', browserPage).translate(3, 4)

expectType<string | null>(browserSession.getCurrentPageNavigationBarTitle())
expectType<{ active: boolean, stopCalls: number }>(browserSession.getPullDownRefreshState())
expectType<{ visible: boolean }>(browserSession.getTabBar())
expectType<Record<string, string>>(browserSession.getFileSnapshot())
expectType<Array<{ createTime: number, filePath: string, size: number }>>(browserSession.getSavedFileListSnapshot())
expectType<string | null>(browserSession.getFileText('headless://wxfile/temp/0001'))
expectType<{
  disconnect: () => void
  observe: (selector: string, callback: (result: {
    boundingClientRect: { bottom: number, height: number, left: number, right: number, top: number, width: number }
    id: string
    intersectionRatio: number
    intersectionRect: { bottom: number, height: number, left: number, right: number, top: number, width: number }
    relativeRect: { bottom: number, height: number, left: number, right: number, top: number, width: number }
  }) => void) => void
  relativeTo: (selector: string, margins?: { bottom?: number, left?: number, right?: number, top?: number }) => any
  relativeToViewport: (margins?: { bottom?: number, left?: number, right?: number, top?: number }) => any
}>(browserPage?.createIntersectionObserver?.({ thresholds: [0, 1] }))
expectType<{
  disconnect: () => void
  observe: (descriptor: {
    height?: number
    maxHeight?: number
    maxWidth?: number
    minHeight?: number
    minWidth?: number
    orientation?: string
    width?: number
  }, callback: (result: { matches: boolean }) => void) => void
}>(browserPage?.createMediaQueryObserver?.())
expectType<{
  exitFullScreen: () => void
  pause: () => void
  play: () => void
  requestFullScreen: () => void
  seek: (position: number) => void
  stop: () => void
}>(browserPage?.wx.createVideoContext('hero-video', browserPage))
expectType<{ createTime: number, errMsg: string, size: number } | undefined>(browserPage?.wx.getSavedFileInfo({ filePath: 'headless://wxfile/saved/0001' }))
expectType<{ errMsg: string, fileList: Array<{ createTime: number, filePath: string, size: number }> } | undefined>(browserPage?.wx.getSavedFileList())
expectType<{ errMsg: string } | undefined>(browserPage?.wx.saveImageToPhotosAlbum({
  filePath: 'headless://wxfile/temp/0001',
}))
expectType<{ errMsg: string } | undefined>(browserPage?.wx.saveVideoToPhotosAlbum({
  filePath: 'headless://wxfile/temp/0001',
}))
expectType<{
  errMsg: string
  height: number
  orientation: 'up'
  path: string
  type: string
  width: number
} | undefined>(browserPage?.wx.getImageInfo({
  src: 'headless://wxfile/temp/0001',
}))
expectType<{ errMsg: string } | undefined>(browserPage?.wx.previewImage({
  current: 'headless://wxfile/temp/0001',
  urls: ['headless://wxfile/temp/0001'],
}))
expectType<{
  errMsg: string
  tempFilePaths: string[]
  tempFiles: Array<{ path: string, size: number }>
} | undefined>(browserPage?.wx.chooseImage({
  count: 2,
  sizeType: ['compressed'],
  sourceType: ['album'],
}))
expectType<{
  duration: number
  errMsg: string
  height: number
  size: number
  tempFilePath: string
  width: number
} | undefined>(browserPage?.wx.chooseVideo({
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
} | undefined>(browserPage?.wx.chooseMedia({
  count: 2,
  maxDuration: 24,
  mediaType: ['image', 'video'],
  sizeType: ['compressed'],
  sourceType: ['album'],
}))
expectType<{
  errMsg: string
  tempFilePath: string
} | undefined>(browserPage?.wx.compressImage({
  compressedHeight: 48,
  compressedWidth: 64,
  quality: 70,
  src: 'headless://wxfile/temp/0001.jpg',
}))
expectType<{ abort: () => void }>(browserPage?.wx.downloadFile({
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
expectType<{ abort: () => void }>(browserPage?.wx.uploadFile({
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

browserPage?.wx.saveFile({
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

browserPage?.wx.getSavedFileList({
  success: (result) => {
    expectType<{ errMsg: string, fileList: Array<{ createTime: number, filePath: string, size: number }> }>(result)
  },
  complete: (result) => {
    expectType<{ errMsg: string, fileList: Array<{ createTime: number, filePath: string, size: number }> } | undefined>(result)
  },
})

browserPage?.wx.getSavedFileInfo({
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

browserPage?.wx.removeSavedFile({
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

const headlessSession = createHeadlessSession({ projectPath: '/tmp/project' })
const headlessPage = headlessSession.getCurrentPages()[0]

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
}>(headlessPage?.wx.createAnimation({
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
}>(headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage))
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).arc(10, 12, 6, 0, Math.PI, false)
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).arcTo(18, 6, 24, 12, 4)
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).bezierCurveTo(10, 4, 14, 8, 18, 12)
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).clip('evenodd')
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).closePath()
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).drawImage('/tmp/thumb.png', 2, 4)
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).drawImage('/tmp/report.png', 4, 6, 12, 8)
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).drawImage('/tmp/sprite.png', 0, 0, 24, 24, 8, 10, 12, 14)
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).rect(2, 3, 16, 10)
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).quadraticCurveTo(8, 4, 12, 16)
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).restore()
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).rotate(0.5)
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).save()
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).scale(1.2, 0.8)
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).setGlobalAlpha(0.6)
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).setLineCap('round')
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).setLineDash([6, 3], 2)
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).setLineJoin('bevel')
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).setMiterLimit(6)
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).setShadow(2, 3, 4, '#112233')
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).fill('evenodd')
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).setTextAlign('center')
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).setTextBaseline('middle')
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).strokeText('canvas', 6, 20)
headlessPage?.wx.createCanvasContext('hero-canvas', headlessPage).translate(3, 4)

expectType<{ active: boolean, stopCalls: number }>(headlessSession.getPullDownRefreshState())
expectType<{ visible: boolean }>(headlessSession.getTabBar())
expectType<Record<string, string>>(headlessSession.getFileSnapshot())
expectType<Array<{ createTime: number, filePath: string, size: number }>>(headlessSession.getSavedFileListSnapshot())
expectType<string | null>(headlessSession.getFileText('headless://wxfile/temp/0001'))
expectType<{
  errMsg: string
  tempFilePath: string
}>(headlessPage?.wx.canvasToTempFilePath({
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
expectType<{
  disconnect: () => void
  observe: (selector: string, callback: (result: {
    boundingClientRect: { bottom: number, height: number, left: number, right: number, top: number, width: number }
    id: string
    intersectionRatio: number
    intersectionRect: { bottom: number, height: number, left: number, right: number, top: number, width: number }
    relativeRect: { bottom: number, height: number, left: number, right: number, top: number, width: number }
  }) => void) => void
  relativeTo: (selector: string, margins?: { bottom?: number, left?: number, right?: number, top?: number }) => any
  relativeToViewport: (margins?: { bottom?: number, left?: number, right?: number, top?: number }) => any
}>(headlessPage?.createIntersectionObserver?.({ thresholds: [0, 1] }))
expectType<{
  disconnect: () => void
  observe: (descriptor: {
    height?: number
    maxHeight?: number
    maxWidth?: number
    minHeight?: number
    minWidth?: number
    orientation?: string
    width?: number
  }, callback: (result: { matches: boolean }) => void) => void
}>(headlessPage?.createMediaQueryObserver?.())
expectType<{
  exitFullScreen: () => void
  pause: () => void
  play: () => void
  requestFullScreen: () => void
  seek: (position: number) => void
  stop: () => void
}>(headlessPage?.wx.createVideoContext('hero-video', headlessPage))
expectType<{ createTime: number, errMsg: string, size: number } | undefined>(headlessPage?.wx.getSavedFileInfo({ filePath: 'headless://wxfile/saved/0001' }))
expectType<{ errMsg: string, fileList: Array<{ createTime: number, filePath: string, size: number }> } | undefined>(headlessPage?.wx.getSavedFileList())
expectType<{ errMsg: string } | undefined>(headlessPage?.wx.saveImageToPhotosAlbum({
  filePath: 'headless://wxfile/temp/0001',
}))
expectType<{ errMsg: string } | undefined>(headlessPage?.wx.saveVideoToPhotosAlbum({
  filePath: 'headless://wxfile/temp/0001',
}))
expectType<{
  errMsg: string
  height: number
  orientation: 'up'
  path: string
  type: string
  width: number
} | undefined>(headlessPage?.wx.getImageInfo({
  src: 'headless://wxfile/temp/0001',
}))
expectType<{ errMsg: string } | undefined>(headlessPage?.wx.previewImage({
  current: 'headless://wxfile/temp/0001',
  urls: ['headless://wxfile/temp/0001'],
}))
expectType<{
  errMsg: string
  tempFilePaths: string[]
  tempFiles: Array<{ path: string, size: number }>
} | undefined>(headlessPage?.wx.chooseImage({
  count: 2,
  sizeType: ['compressed'],
  sourceType: ['album'],
}))
expectType<{
  duration: number
  errMsg: string
  height: number
  size: number
  tempFilePath: string
  width: number
} | undefined>(headlessPage?.wx.chooseVideo({
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
} | undefined>(headlessPage?.wx.chooseMedia({
  count: 2,
  maxDuration: 24,
  mediaType: ['image', 'video'],
  sizeType: ['compressed'],
  sourceType: ['album'],
}))
expectType<{
  errMsg: string
  tempFilePath: string
} | undefined>(headlessPage?.wx.compressImage({
  compressedHeight: 48,
  compressedWidth: 64,
  quality: 70,
  src: 'headless://wxfile/temp/0001.jpg',
}))
expectType<{ abort: () => void }>(headlessPage?.wx.downloadFile({
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
expectType<{ abort: () => void }>(headlessPage?.wx.uploadFile({
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

headlessPage?.wx.saveFile({
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

headlessPage?.wx.getSavedFileList({
  success: (result) => {
    expectType<{ errMsg: string, fileList: Array<{ createTime: number, filePath: string, size: number }> }>(result)
  },
  complete: (result) => {
    expectType<{ errMsg: string, fileList: Array<{ createTime: number, filePath: string, size: number }> } | undefined>(result)
  },
})

headlessPage?.wx.getSavedFileInfo({
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

headlessPage?.wx.removeSavedFile({
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

const launchResult = launch({ projectPath: '/tmp/project' })
expectType<Promise<{
  currentPage: () => Promise<unknown>
  pageScrollTo: (scrollTop: number) => Promise<void>
  reLaunch: (route: string) => Promise<unknown>
  scopeSnapshot: (scopeId: string) => Promise<unknown>
  selectAllComponents: (selector: string) => Promise<Array<{ callMethod: (methodName: string, ...args: any[]) => Promise<unknown>, scopeId: string, snapshot: () => Promise<unknown> }>>
  selectComponent: (selector: string) => Promise<{ callMethod: (methodName: string, ...args: any[]) => Promise<unknown>, scopeId: string, snapshot: () => Promise<unknown> } | null>
  waitForComponent: (selector: string, options?: { interval?: number, timeout?: number }) => Promise<{ callMethod: (methodName: string, ...args: any[]) => Promise<unknown>, scopeId: string, snapshot: () => Promise<unknown> }>
}>>(launchResult)
