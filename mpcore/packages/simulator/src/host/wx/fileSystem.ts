import type { HeadlessWxCallbackOption } from './core'

export interface HeadlessWxFileSystemError extends Error {
  errMsg: string
}

export interface HeadlessWxFileSystemCallbackOption<TResult> extends Omit<HeadlessWxCallbackOption<TResult>, 'fail' | 'complete'> {
  fail?: (error: HeadlessWxFileSystemError) => void
  complete?: (result?: TResult | HeadlessWxFileSystemError) => void
}

export interface HeadlessWxFileSystemResult {
  errMsg: string
}

export interface HeadlessWxReadFileSuccessResult {
  data: string | ArrayBuffer
  errMsg: string
}

export interface HeadlessWxReadFileOption extends HeadlessWxFileSystemCallbackOption<HeadlessWxReadFileSuccessResult> {
  encoding?: string
  filePath: string
}

export interface HeadlessWxWriteFileOption extends HeadlessWxFileSystemCallbackOption<HeadlessWxFileSystemResult> {
  data: string | ArrayBuffer
  encoding?: string
  filePath: string
}

export interface HeadlessWxAccessFileOption extends HeadlessWxFileSystemCallbackOption<HeadlessWxFileSystemResult> {
  path: string
}

export interface HeadlessWxAppendFileOption extends HeadlessWxFileSystemCallbackOption<HeadlessWxFileSystemResult> {
  data: string | ArrayBuffer
  encoding?: string
  filePath: string
}

export interface HeadlessWxUnlinkOption extends HeadlessWxFileSystemCallbackOption<HeadlessWxFileSystemResult> {
  filePath: string
}

export interface HeadlessWxCopyFileOption extends HeadlessWxFileSystemCallbackOption<HeadlessWxFileSystemResult> {
  destPath: string
  srcPath: string
}

export interface HeadlessWxRenameOption extends HeadlessWxFileSystemCallbackOption<HeadlessWxFileSystemResult> {
  newPath: string
  oldPath: string
}

export interface HeadlessWxMkdirOption extends HeadlessWxFileSystemCallbackOption<HeadlessWxFileSystemResult> {
  dirPath: string
  recursive?: boolean
}

export interface HeadlessWxRmdirOption extends HeadlessWxFileSystemCallbackOption<HeadlessWxFileSystemResult> {
  dirPath: string
  recursive?: boolean
}

export interface HeadlessWxReadDirSuccessResult {
  errMsg: string
  files: string[]
}

export interface HeadlessWxReadDirOption extends HeadlessWxFileSystemCallbackOption<HeadlessWxReadDirSuccessResult> {
  dirPath: string
}

export interface HeadlessWxStats {
  isDirectory: () => boolean
  isFile: () => boolean
  size: number
}

export interface HeadlessWxStatSuccessResult {
  errMsg: string
  stats: HeadlessWxStats
}

export interface HeadlessWxStatOption extends HeadlessWxFileSystemCallbackOption<HeadlessWxStatSuccessResult> {
  path: string
}

export interface HeadlessWxFileSystemManager {
  access: (option: HeadlessWxAccessFileOption) => HeadlessWxFileSystemResult | undefined
  accessSync: (path: string) => void
  appendFile: (option: HeadlessWxAppendFileOption) => HeadlessWxFileSystemResult | undefined
  appendFileSync: (filePath: string, data: string | ArrayBuffer, encoding?: string) => void
  copyFile: (option: HeadlessWxCopyFileOption) => HeadlessWxFileSystemResult | undefined
  copyFileSync: (srcPath: string, destPath: string) => void
  mkdir: (option: HeadlessWxMkdirOption) => HeadlessWxFileSystemResult | undefined
  mkdirSync: (dirPath: string, recursive?: boolean) => void
  readFile: (option: HeadlessWxReadFileOption) => HeadlessWxReadFileSuccessResult | undefined
  readFileSync: {
    (filePath: string, encoding?: undefined): ArrayBuffer
    (filePath: string, encoding: string): string
    (filePath: string, encoding?: string): string | ArrayBuffer
  }
  readdir: (option: HeadlessWxReadDirOption) => HeadlessWxReadDirSuccessResult | undefined
  readdirSync: (dirPath: string) => string[]
  rmdir: (option: HeadlessWxRmdirOption) => HeadlessWxFileSystemResult | undefined
  rmdirSync: (dirPath: string, recursive?: boolean) => void
  rename: (option: HeadlessWxRenameOption) => HeadlessWxFileSystemResult | undefined
  renameSync: (oldPath: string, newPath: string) => void
  stat: (option: HeadlessWxStatOption) => HeadlessWxStatSuccessResult | undefined
  statSync: (path: string) => HeadlessWxStats
  unlink: (option: HeadlessWxUnlinkOption) => HeadlessWxFileSystemResult | undefined
  unlinkSync: (filePath: string) => void
  writeFile: (option: HeadlessWxWriteFileOption) => HeadlessWxFileSystemResult | undefined
  writeFileSync: (filePath: string, data: string | ArrayBuffer, encoding?: string) => void
}
