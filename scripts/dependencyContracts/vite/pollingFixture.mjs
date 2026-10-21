import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

/** 使用原生真实路径展开 Windows 短目录名，避免独立订阅与 Vite 使用不同路径键。 */
export function resolvePollingFixtureRoot(directory) {
  return fs.realpathSync.native(directory)
}

/** 仅统一宿主路径格式；目录别名必须在订阅前消除，不能在断言中掩盖。 */
export function assertPollingFixtureRoot(serverRoot, canonicalRoot, platform = process.platform) {
  const hostPath = platform === 'win32' ? path.win32 : path.posix
  assert.equal(hostPath.resolve(serverRoot), canonicalRoot, 'Vite and independent polling listeners must use the same canonical fixture root')
}
