import type { HeadlessWxCallbackOption } from './core'

export interface HeadlessWxFileSystemResult {
  errMsg: string
}

export interface HeadlessWxReadFileSuccessResult {
  data: string
  errMsg: string
}

export interface HeadlessWxReadFileOption extends HeadlessWxCallbackOption<HeadlessWxReadFileSuccessResult> {
  encoding?: string
  filePath: string
}

export interface HeadlessWxWriteFileOption extends HeadlessWxCallbackOption<HeadlessWxFileSystemResult> {
  data: string
  encoding?: string
  filePath: string
}

export interface HeadlessWxAccessFileOption extends HeadlessWxCallbackOption<HeadlessWxFileSystemResult> {
  path: string
}

export interface HeadlessWxAppendFileOption extends HeadlessWxCallbackOption<HeadlessWxFileSystemResult> {
  data: string
  encoding?: string
  filePath: string
}

export interface HeadlessWxUnlinkOption extends HeadlessWxCallbackOption<HeadlessWxFileSystemResult> {
  filePath: string
}

export interface HeadlessWxCopyFileOption extends HeadlessWxCallbackOption<HeadlessWxFileSystemResult> {
  destPath: string
  srcPath: string
}

export interface HeadlessWxRenameOption extends HeadlessWxCallbackOption<HeadlessWxFileSystemResult> {
  newPath: string
  oldPath: string
}

export interface HeadlessWxMkdirOption extends HeadlessWxCallbackOption<HeadlessWxFileSystemResult> {
  dirPath: string
  recursive?: boolean
}

export interface HeadlessWxRmdirOption extends HeadlessWxCallbackOption<HeadlessWxFileSystemResult> {
  dirPath: string
  recursive?: boolean
}

export interface HeadlessWxReadDirSuccessResult {
  errMsg: string
  files: string[]
}

export interface HeadlessWxReadDirOption extends HeadlessWxCallbackOption<HeadlessWxReadDirSuccessResult> {
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

export interface HeadlessWxStatOption extends HeadlessWxCallbackOption<HeadlessWxStatSuccessResult> {
  path: string
}

export interface HeadlessWxFileSystemManager {
  access: (option: HeadlessWxAccessFileOption) => HeadlessWxFileSystemResult | undefined
  accessSync: (path: string) => void
  appendFile: (option: HeadlessWxAppendFileOption) => HeadlessWxFileSystemResult | undefined
  appendFileSync: (filePath: string, data: string, encoding?: string) => void
  copyFile: (option: HeadlessWxCopyFileOption) => HeadlessWxFileSystemResult | undefined
  copyFileSync: (srcPath: string, destPath: string) => void
  mkdir: (option: HeadlessWxMkdirOption) => HeadlessWxFileSystemResult | undefined
  mkdirSync: (dirPath: string, recursive?: boolean) => void
  readFile: (option: HeadlessWxReadFileOption) => HeadlessWxReadFileSuccessResult | undefined
  readFileSync: (filePath: string, encoding?: string) => string
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
  writeFileSync: (filePath: string, data: string, encoding?: string) => void
}
