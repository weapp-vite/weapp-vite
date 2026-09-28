import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

/** 同一清理入口覆盖正常关闭和 Vite 主动退出；exit 阶段只能同步删除本会话目录。 */
export function createInspectorTemporaryRoot(prefix: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  let removed = false

  function remove() {
    if (removed) {
      return
    }
    fs.rmSync(root, { recursive: true, force: true })
    removed = true
    process.removeListener('exit', remove)
  }

  process.once('exit', remove)
  return { root, remove }
}
