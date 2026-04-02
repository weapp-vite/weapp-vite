import type {
  ChooseAddressOptions,
  ChooseFileOptions,
  ChooseImageOptions,
  ChooseLocationOptions,
  ChooseMediaOptions,
  ChooseMessageFileOptions,
  ChooseVideoOptions,
  CompressImageOptions,
  CompressVideoOptions,
  GetClipboardDataOptions,
  GetImageInfoOptions,
  GetVideoInfoOptions,
  MakePhoneCallOptions,
  OpenCustomerServiceChatOptions,
  OpenDocumentOptions,
  OpenLocationOptions,
  OpenVideoEditorOptions,
  PreviewImageOptions,
  PreviewMediaOptions,
  RequestPaymentOptions,
  RequestSubscribeMessageOptions,
  RequestSubscribeMessageSuccessResult,
  SaveFileOptions,
  SaveFileToDiskOptions,
  SaveImageToPhotosAlbumOptions,
  SaveVideoToPhotosAlbumOptions,
  ScanCodeOptions,
  SetClipboardDataOptions,
  ShareMenuOptions,
  ShowActionSheetOptions,
  ShowLoadingOptions,
  ShowModalOptions,
  ShowToastOptions,
  TabBarOptions,
  WxAsyncOptions,
  WxBaseResult,
} from './types'
import {
  getClipboardDataBridge,
  openCustomerServiceChatBridge,
  scanCodeBridge,
  setClipboardDataBridge,
} from './interactionApi'
import {
  chooseAddressBridge,
  chooseLocationBridge,
  makePhoneCallBridge,
  openLocationBridge,
} from './locationApi'
import {
  chooseFileBridge,
  chooseImageBridge,
  chooseMediaBridge,
  chooseMessageFileBridge,
  chooseVideoBridge,
  compressImageBridge,
  compressVideoBridge,
  getImageInfoBridge,
  getVideoInfoBridge,
  openDocumentBridge,
  openVideoEditorBridge,
  previewImageBridge,
  previewMediaBridge,
  saveFileBridge,
  saveFileToDiskBridge,
  saveImageToPhotosAlbumBridge,
  saveVideoToPhotosAlbumBridge,
} from './mediaApi'
import {
  hideTabBarBridge,
  requestPaymentBridge,
  requestSubscribeMessageBridge,
  showActionSheetBridge,
  showModalBridge,
  showShareMenuBridge,
  showTabBarBridge,
  updateShareMenuBridge,
} from './menuApi'
import {
  hideLoadingBridge,
  showLoadingBridge,
  showToastBridge,
} from './uiFeedback'

export function showToast(options?: ShowToastOptions) {
  return showToastBridge(options)
}

export function showLoading(options?: ShowLoadingOptions) {
  return showLoadingBridge(options)
}

export function hideLoading(options?: WxAsyncOptions<WxBaseResult>) {
  return hideLoadingBridge(options)
}

export function showShareMenu(options?: ShareMenuOptions) {
  return showShareMenuBridge(options)
}

export function updateShareMenu(options?: ShareMenuOptions) {
  return updateShareMenuBridge(options)
}

export function openCustomerServiceChat(options?: OpenCustomerServiceChatOptions) {
  return openCustomerServiceChatBridge(options)
}

export function makePhoneCall(options?: MakePhoneCallOptions) {
  return makePhoneCallBridge(options)
}

export function chooseAddress(options?: ChooseAddressOptions) {
  return chooseAddressBridge(options)
}

export function chooseLocation(options?: ChooseLocationOptions) {
  return chooseLocationBridge(options)
}

export function openLocation(options?: OpenLocationOptions) {
  return openLocationBridge(options)
}

export function getImageInfo(options?: GetImageInfoOptions) {
  return getImageInfoBridge(options)
}

export function getVideoInfo(options?: GetVideoInfoOptions) {
  return getVideoInfoBridge(options)
}

export function showTabBar(options?: TabBarOptions) {
  return showTabBarBridge(options)
}

export function hideTabBar(options?: TabBarOptions) {
  return hideTabBarBridge(options)
}

export function requestPayment(options?: RequestPaymentOptions) {
  return requestPaymentBridge(options)
}

export function requestSubscribeMessage(options?: RequestSubscribeMessageOptions): Promise<RequestSubscribeMessageSuccessResult> {
  return requestSubscribeMessageBridge(options)
}

export function showModal(options?: ShowModalOptions) {
  return showModalBridge(options)
}

export function showActionSheet(options?: ShowActionSheetOptions) {
  return showActionSheetBridge(options)
}

export async function chooseImage(options?: ChooseImageOptions) {
  return chooseImageBridge(options)
}

export async function chooseMedia(options?: ChooseMediaOptions) {
  return chooseMediaBridge(options)
}

export async function compressImage(options?: CompressImageOptions) {
  return compressImageBridge(options)
}

export function compressVideo(options?: CompressVideoOptions) {
  return compressVideoBridge(options)
}

export async function chooseVideo(options?: ChooseVideoOptions) {
  return chooseVideoBridge(options)
}

export async function chooseMessageFile(options?: ChooseMessageFileOptions) {
  return chooseMessageFileBridge(options)
}

export async function chooseFile(options?: ChooseFileOptions) {
  return chooseFileBridge(options)
}

export function previewImage(options?: PreviewImageOptions) {
  return previewImageBridge(options)
}

export function previewMedia(options?: PreviewMediaOptions) {
  return previewMediaBridge(options)
}

export function openVideoEditor(options?: OpenVideoEditorOptions) {
  return openVideoEditorBridge(options)
}

export function saveImageToPhotosAlbum(options?: SaveImageToPhotosAlbumOptions) {
  return saveImageToPhotosAlbumBridge(options)
}

export function saveVideoToPhotosAlbum(options?: SaveVideoToPhotosAlbumOptions) {
  return saveVideoToPhotosAlbumBridge(options)
}

export function saveFile(options?: SaveFileOptions) {
  return saveFileBridge(options)
}

export function saveFileToDisk(options?: SaveFileToDiskOptions) {
  return saveFileToDiskBridge(options)
}

export function openDocument(options?: OpenDocumentOptions) {
  return openDocumentBridge(options)
}

export function scanCode(options?: ScanCodeOptions) {
  return scanCodeBridge(options)
}

export async function setClipboardData(options?: SetClipboardDataOptions) {
  return setClipboardDataBridge(options)
}

export async function getClipboardData(options?: GetClipboardDataOptions) {
  return getClipboardDataBridge(options)
}
