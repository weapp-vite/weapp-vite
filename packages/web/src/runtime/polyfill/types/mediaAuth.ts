import type { WxAsyncOptions, WxBaseResult } from './base'

export interface AuthSettingResult {
  authSetting: Record<string, boolean>
}

export interface GetSettingSuccessResult extends WxBaseResult, AuthSettingResult {}

export interface GetSettingOptions extends WxAsyncOptions<GetSettingSuccessResult> {}

export interface AuthorizeOptions extends WxAsyncOptions<WxBaseResult> {
  scope?: string
}

export interface OpenSettingSuccessResult extends WxBaseResult, AuthSettingResult {}

export interface OpenSettingOptions extends WxAsyncOptions<OpenSettingSuccessResult> {}

export type ChooseMediaType = 'image' | 'video'

export interface ChooseMediaTempFile {
  tempFilePath: string
  size: number
  fileType: ChooseMediaType
  thumbTempFilePath?: string
  width: number
  height: number
  duration: number
}

export interface ChooseMediaSuccessResult extends WxBaseResult {
  type: ChooseMediaType
  tempFiles: ChooseMediaTempFile[]
}

export interface ChooseMediaOptions extends WxAsyncOptions<ChooseMediaSuccessResult> {
  count?: number
  mediaType?: Array<'image' | 'video' | 'mix'>
  sourceType?: Array<'album' | 'camera'>
  maxDuration?: number
  sizeType?: Array<'original' | 'compressed'>
  camera?: 'back' | 'front'
}

export interface CompressImageSuccessResult extends WxBaseResult {
  tempFilePath: string
}

export interface CompressImageOptions extends WxAsyncOptions<CompressImageSuccessResult> {
  src?: string
  quality?: number
  compressedWidth?: number
  compressedHeight?: number
}

export interface ChooseVideoSuccessResult extends WxBaseResult {
  tempFilePath: string
  duration: number
  size: number
  height: number
  width: number
}

export interface ChooseVideoOptions extends WxAsyncOptions<ChooseVideoSuccessResult> {
  sourceType?: Array<'album' | 'camera'>
  compressed?: boolean
  maxDuration?: number
  camera?: 'back' | 'front'
}

export interface GetVideoInfoSuccessResult extends WxBaseResult {
  size: number
  duration: number
  width: number
  height: number
  fps: number
  bitrate: number
  type: string
  orientation: 'up'
}

export interface GetVideoInfoOptions extends WxAsyncOptions<GetVideoInfoSuccessResult> {
  src?: string
}

export interface CompressVideoSuccessResult extends WxBaseResult {
  tempFilePath: string
  size: number
  duration: number
  width: number
  height: number
  bitrate: number
  fps: number
}

export interface CompressVideoOptions extends WxAsyncOptions<CompressVideoSuccessResult> {
  src?: string
  quality?: 'low' | 'medium' | 'high'
  bitrate?: number
}

export interface MediaPreviewSource {
  url: string
  type?: 'image' | 'video'
  poster?: string
}

export interface PreviewMediaOptions extends WxAsyncOptions<WxBaseResult> {
  sources?: MediaPreviewSource[]
  current?: number
}

export interface SaveVideoToPhotosAlbumOptions extends WxAsyncOptions<WxBaseResult> {
  filePath?: string
}

export interface ChooseFileSuccessResult extends WxBaseResult {
  tempFiles: ChooseMessageFileTempFile[]
}

export interface ChooseFileOptions extends WxAsyncOptions<ChooseFileSuccessResult> {
  count?: number
  type?: 'all' | 'video' | 'image' | 'file'
  extension?: string[]
}

export interface OpenVideoEditorSuccessResult extends WxBaseResult {
  tempFilePath: string
}

export interface OpenVideoEditorOptions extends WxAsyncOptions<OpenVideoEditorSuccessResult> {
  src?: string
}

export interface SaveFileSuccessResult extends WxBaseResult {
  savedFilePath: string
}

export interface SaveFileOptions extends WxAsyncOptions<SaveFileSuccessResult> {
  tempFilePath?: string
  filePath?: string
}

export interface SaveFileToDiskOptions extends WxAsyncOptions<WxBaseResult> {
  filePath?: string
  fileName?: string
}

export interface ChooseMessageFileTempFile {
  path: string
  size: number
  type: string
  name: string
  time: number
}

export interface ChooseMessageFileSuccessResult extends WxBaseResult {
  tempFiles: ChooseMessageFileTempFile[]
}

export interface ChooseMessageFileOptions extends WxAsyncOptions<ChooseMessageFileSuccessResult> {
  count?: number
  type?: 'all' | 'video' | 'image' | 'file'
}

export interface SaveImageToPhotosAlbumOptions extends WxAsyncOptions<WxBaseResult> {
  filePath?: string
}

export interface ScanCodeSuccessResult extends WxBaseResult {
  result: string
  scanType: string
  charSet: string
  path: string
  rawData: string
}

export interface ScanCodeOptions extends WxAsyncOptions<ScanCodeSuccessResult> {
  onlyFromCamera?: boolean
  scanType?: string[]
}
