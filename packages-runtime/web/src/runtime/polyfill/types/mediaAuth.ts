import type { MiniProgramAsyncOptions, MiniProgramBaseResult } from './base'

export interface AuthSettingResult {
  authSetting: Record<string, boolean>
}

export interface GetSettingSuccessResult extends MiniProgramBaseResult, AuthSettingResult {}

export interface GetSettingOptions extends MiniProgramAsyncOptions<GetSettingSuccessResult> {}

export interface AuthorizeOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  scope?: string
}

export interface OpenSettingSuccessResult extends MiniProgramBaseResult, AuthSettingResult {}

export interface OpenSettingOptions extends MiniProgramAsyncOptions<OpenSettingSuccessResult> {}

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

export interface ChooseMediaSuccessResult extends MiniProgramBaseResult {
  type: ChooseMediaType
  tempFiles: ChooseMediaTempFile[]
}

export interface ChooseMediaOptions extends MiniProgramAsyncOptions<ChooseMediaSuccessResult> {
  count?: number
  mediaType?: Array<'image' | 'video' | 'mix'>
  sourceType?: Array<'album' | 'camera'>
  maxDuration?: number
  sizeType?: Array<'original' | 'compressed'>
  camera?: 'back' | 'front'
}

export interface CompressImageSuccessResult extends MiniProgramBaseResult {
  tempFilePath: string
}

export interface CompressImageOptions extends MiniProgramAsyncOptions<CompressImageSuccessResult> {
  src?: string
  quality?: number
  compressedWidth?: number
  compressedHeight?: number
}

export interface ChooseVideoSuccessResult extends MiniProgramBaseResult {
  tempFilePath: string
  duration: number
  size: number
  height: number
  width: number
}

export interface ChooseVideoOptions extends MiniProgramAsyncOptions<ChooseVideoSuccessResult> {
  sourceType?: Array<'album' | 'camera'>
  compressed?: boolean
  maxDuration?: number
  camera?: 'back' | 'front'
}

export interface GetVideoInfoSuccessResult extends MiniProgramBaseResult {
  size: number
  duration: number
  width: number
  height: number
  fps: number
  bitrate: number
  type: string
  orientation: 'up'
}

export interface GetVideoInfoOptions extends MiniProgramAsyncOptions<GetVideoInfoSuccessResult> {
  src?: string
}

export interface CompressVideoSuccessResult extends MiniProgramBaseResult {
  tempFilePath: string
  size: number
  duration: number
  width: number
  height: number
  bitrate: number
  fps: number
}

export interface CompressVideoOptions extends MiniProgramAsyncOptions<CompressVideoSuccessResult> {
  src?: string
  quality?: 'low' | 'medium' | 'high'
  bitrate?: number
}

export interface MediaPreviewSource {
  url: string
  type?: 'image' | 'video'
  poster?: string
}

export interface PreviewMediaOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  sources?: MediaPreviewSource[]
  current?: number
}

export interface SaveVideoToPhotosAlbumOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  filePath?: string
}

export interface ChooseFileSuccessResult extends MiniProgramBaseResult {
  tempFiles: ChooseMessageFileTempFile[]
}

export interface ChooseFileOptions extends MiniProgramAsyncOptions<ChooseFileSuccessResult> {
  count?: number
  type?: 'all' | 'video' | 'image' | 'file'
  extension?: string[]
}

export interface OpenVideoEditorSuccessResult extends MiniProgramBaseResult {
  tempFilePath: string
}

export interface OpenVideoEditorOptions extends MiniProgramAsyncOptions<OpenVideoEditorSuccessResult> {
  src?: string
}

export interface SaveFileSuccessResult extends MiniProgramBaseResult {
  savedFilePath: string
}

export interface SaveFileOptions extends MiniProgramAsyncOptions<SaveFileSuccessResult> {
  tempFilePath?: string
  filePath?: string
}

export interface SaveFileToDiskOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
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

export interface ChooseMessageFileSuccessResult extends MiniProgramBaseResult {
  tempFiles: ChooseMessageFileTempFile[]
}

export interface ChooseMessageFileOptions extends MiniProgramAsyncOptions<ChooseMessageFileSuccessResult> {
  count?: number
  type?: 'all' | 'video' | 'image' | 'file'
}

export interface SaveImageToPhotosAlbumOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  filePath?: string
}

export interface ScanCodeSuccessResult extends MiniProgramBaseResult {
  result: string
  scanType: string
  charSet: string
  path: string
  rawData: string
}

export interface ScanCodeOptions extends MiniProgramAsyncOptions<ScanCodeSuccessResult> {
  onlyFromCamera?: boolean
  scanType?: string[]
}
