import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetWebRuntimeHost, setWebRuntimeHost } from '../src/runtime/host'
import {
  openDocumentBridge,
  saveFileBridge,
  saveFileToDiskBridge,
  saveImageToPhotosAlbumBridge,
  saveVideoToPhotosAlbumBridge,
} from '../src/runtime/polyfill/mediaApi/file'
import { getImageInfoBridge, getVideoInfoBridge } from '../src/runtime/polyfill/mediaApi/info'
import {
  chooseFileBridge,
  chooseImageBridge,
  chooseMediaBridge,
  chooseMessageFileBridge,
  chooseVideoBridge,
} from '../src/runtime/polyfill/mediaApi/picker'
import {
  openVideoEditorBridge,
  previewImageBridge,
  previewMediaBridge,
} from '../src/runtime/polyfill/mediaApi/preview'
import { compressImageBridge, compressVideoBridge } from '../src/runtime/polyfill/mediaApi/process'
import {
  hideTabBarBridge,
  setTabBarBadgeBridge,
  setTabBarItemBridge,
  setTabBarStyleBridge,
  showTabBarBridge,
} from '../src/runtime/polyfill/menuApi'
import {
  downloadFileByFetchBridge,
  requestByFetchBridge,
  uploadFileByFetchBridge,
} from '../src/runtime/polyfill/network/requestBridge'

describe('polyfill API input branch matrix', () => {
  afterEach(() => {
    resetWebRuntimeHost()
    vi.unstubAllGlobals()
  })

  it('normalizes tab bar mutation option fields', async () => {
    await expect(showTabBarBridge()).resolves.toMatchObject({ errMsg: 'showTabBar:ok' })
    await expect(hideTabBarBridge({ animation: false })).resolves.toMatchObject({ errMsg: 'hideTabBar:ok' })
    await expect(setTabBarItemBridge({
      index: -1,
      text: 1,
      iconPath: null,
      selectedIconPath: false,
    })).rejects.toMatchObject({ errMsg: 'setTabBarItem:fail invalid index' })
    await expect(setTabBarItemBridge({
      index: -1,
      text: 'Label',
      iconPath: '/icon.png',
      selectedIconPath: '/selected.png',
    })).rejects.toMatchObject({ errMsg: 'setTabBarItem:fail invalid index' })
    await expect(setTabBarStyleBridge({
      color: 1,
      selectedColor: null,
      backgroundColor: false,
      borderStyle: 'invalid',
    })).rejects.toMatchObject({ errMsg: expect.stringContaining('fail') })
    await expect(setTabBarStyleBridge({
      color: '#000',
      selectedColor: '#fff',
      backgroundColor: '#eee',
      borderStyle: 'white',
    })).rejects.toMatchObject({ errMsg: expect.stringContaining('fail') })
    await expect(setTabBarBadgeBridge({ index: 0, text: 1 })).rejects.toMatchObject({ errMsg: expect.stringContaining('fail') })
  })

  it('rejects non-string media file and process paths', async () => {
    await expect(saveImageToPhotosAlbumBridge({ filePath: 1 })).rejects.toMatchObject({ errMsg: expect.stringContaining('invalid') })
    await expect(saveVideoToPhotosAlbumBridge({ filePath: null })).rejects.toMatchObject({ errMsg: expect.stringContaining('invalid') })
    await expect(saveFileBridge({ tempFilePath: false })).rejects.toMatchObject({ errMsg: expect.stringContaining('invalid') })
    await expect(saveFileToDiskBridge({ filePath: 1, fileName: 1 })).rejects.toMatchObject({ errMsg: expect.stringContaining('invalid') })
    await expect(saveFileToDiskBridge({ filePath: '/download.bin', fileName: 1 })).resolves.toMatchObject({
      errMsg: 'saveFileToDisk:ok',
    })
    await expect(openDocumentBridge({ filePath: null })).rejects.toMatchObject({ errMsg: expect.stringContaining('invalid') })
    await expect(compressImageBridge({ src: 1 })).rejects.toMatchObject({ errMsg: expect.stringContaining('invalid') })
    await expect(compressVideoBridge({ src: false })).rejects.toMatchObject({ errMsg: expect.stringContaining('invalid') })
  })

  it('covers preview defaults, bounds, and source coercion', async () => {
    const open = vi.fn()
    setWebRuntimeHost({ open })
    await expect(previewImageBridge({ urls: ['/a.png'], current: 1 })).resolves.toMatchObject({ errMsg: 'previewImage:ok' })
    await expect(previewImageBridge({ urls: ['/a.png'], current: '/missing.png' })).resolves.toMatchObject({ errMsg: 'previewImage:ok' })
    await expect(previewMediaBridge({ sources: [{ url: '/a.png' }], current: Number.NaN })).resolves.toMatchObject({ errMsg: 'previewMedia:ok' })
    await expect(previewMediaBridge({ sources: [{ url: '/a.png' }], current: 9 })).resolves.toMatchObject({ errMsg: 'previewMedia:ok' })
    await expect(openVideoEditorBridge({ src: 1 })).rejects.toMatchObject({ errMsg: expect.stringContaining('invalid') })
    await expect(previewImageBridge({ urls: 1 })).rejects.toMatchObject({ errMsg: expect.stringContaining('invalid') })
    expect(open).toHaveBeenCalledTimes(4)
  })

  it('supports callback-style invalid image info and non-string video info', async () => {
    const fail = vi.fn()
    await expect(getImageInfoBridge({ src: 1, fail })).resolves.toMatchObject({ errMsg: expect.stringContaining('invalid') })
    expect(fail).toHaveBeenCalled()
    await expect(getVideoInfoBridge({ src: null })).rejects.toMatchObject({ errMsg: expect.stringContaining('invalid') })
  })

  it('normalizes picker failures thrown as non-Error values', async () => {
    vi.stubGlobal('showOpenFilePicker', vi.fn().mockRejectedValue('picker denied'))
    for (const choose of [chooseImageBridge, chooseMediaBridge, chooseVideoBridge, chooseMessageFileBridge, chooseFileBridge]) {
      await expect(choose()).rejects.toMatchObject({ errMsg: expect.stringContaining('picker denied') })
    }

    vi.stubGlobal('showOpenFilePicker', vi.fn().mockResolvedValue([]))
    await expect(chooseMediaBridge({ mediaType: ['video'] })).resolves.toMatchObject({
      type: 'video',
      tempFiles: [],
    })
  })

  it('normalizes fetch bridge failures thrown as non-Error values', async () => {
    setWebRuntimeHost({ fetch: vi.fn().mockRejectedValue('offline') as any })
    await expect(requestByFetchBridge({ url: '/request' })).rejects.toMatchObject({ errMsg: 'request:fail offline' })
    await expect(downloadFileByFetchBridge({ url: '/download' })).rejects.toMatchObject({ errMsg: 'downloadFile:fail offline' })
    await expect(uploadFileByFetchBridge({ url: '/upload', filePath: '/file', name: 'file' })).rejects.toMatchObject({
      errMsg: 'uploadFile:fail offline',
    })
  })
})
