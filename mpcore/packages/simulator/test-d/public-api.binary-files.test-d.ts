import type { ArtifactContent, ArtifactSource, BrowserVirtualFiles, HeadlessWx } from '..'
import { expectAssignable, expectType } from 'tsd'
import {
  copyArtifactBinary,
  createBrowserVirtualFiles,
  createBrowserVirtualFilesFromDirectory,
  createMemoryArtifactSource,
  readArtifactText,
  readBrowserVirtualBinary,
  readBrowserVirtualFile,
} from '..'

const binary = new Uint8Array([0, 97, 115, 109]).buffer
expectAssignable<ArtifactContent>(binary)
expectType<ArrayBuffer>(copyArtifactBinary('中文'))
expectType<string>(readArtifactText(binary))
const source = createMemoryArtifactSource([['assets/sql.wasm', binary]])
expectType<ArrayBuffer | undefined>(source.readBinary?.('assets/sql.wasm'))
expectAssignable<ArtifactSource>({ has: () => false, readText: () => undefined })

const textFiles = createBrowserVirtualFiles([['app.js', 'App({})']])
expectAssignable<Map<string, string>>(textFiles)
const binaryFiles = createBrowserVirtualFiles([['assets/sql.wasm', binary]])
expectType<Map<string, ArrayBuffer>>(binaryFiles)
expectType<ArrayBuffer | undefined>(readBrowserVirtualBinary(binaryFiles, 'assets/sql.wasm'))
expectType<string | undefined>(readBrowserVirtualFile(binaryFiles, 'assets/sql.wasm'))
expectType<Promise<BrowserVirtualFiles>>(createBrowserVirtualFilesFromDirectory([{
  name: 'sql.wasm',
  text: async () => '',
  arrayBuffer: async () => binary,
}]))

declare const wx: HeadlessWx
expectType<string>(wx.env.USER_DATA_PATH)
const fs = wx.getFileSystemManager()
expectType<ArrayBuffer>(fs.readFileSync('snapshot.db'))
expectType<string>(fs.readFileSync('snapshot.db', 'utf8'))
declare const encoding: string | undefined
expectType<string | ArrayBuffer>(fs.readFileSync('snapshot.db', encoding))
expectType<void>(fs.writeFileSync('snapshot.db', binary))
expectType<void>(fs.appendFileSync('snapshot.db', binary))
fs.writeFile({ filePath: 'snapshot.db', data: binary })
fs.readFile({ filePath: 'snapshot.db', success: result => expectType<string | ArrayBuffer>(result.data) })
fs.unlink({
  filePath: 'missing.db',
  fail: error => expectType<string>(error.errMsg),
  complete: result => expectType<string | undefined>(result?.errMsg),
})
