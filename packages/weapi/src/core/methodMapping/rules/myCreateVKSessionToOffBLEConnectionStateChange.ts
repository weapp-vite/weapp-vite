import type { WeapiMethodMappingRule } from '../types'

export const MY_METHOD_MAPPINGS_CREATE_VKSESSION_TO_OFF_BLECONNECTION_STATE_CHANGE: Readonly<Record<string, WeapiMethodMappingRule>> = {
  createVKSession: {
    target: 'createVKSession',
  },
  compressVideo: {
    target: 'compressVideo',
  },
  openVideoEditor: {
    target: 'openVideoEditor',
  },
  getShareInfo: {
    target: 'getShareInfo',
  },
  joinVoIPChat: {
    target: 'joinVoIPChat',
  },
  openDocument: {
    target: 'openDocument',
  },
  saveVideoToPhotosAlbum: {
    target: 'saveVideoToPhotosAlbum',
  },
  batchSetStorage: {
    target: 'batchSetStorage',
  },
  batchGetStorage: {
    target: 'batchGetStorage',
  },
  batchSetStorageSync: {
    target: 'batchSetStorageSync',
  },
  batchGetStorageSync: {
    target: 'batchGetStorageSync',
  },
  createCameraContext: {
    target: 'createCameraContext',
  },
  offMemoryWarning: {
    target: 'offMemoryWarning',
  },
  cancelIdleCallback: {
    target: 'cancelIdleCallback',
  },
  onBLEConnectionStateChange: {
    target: 'onBLEConnectionStateChanged',
  },
  offBLEConnectionStateChange: {
    target: 'offBLEConnectionStateChanged',
  },
}
