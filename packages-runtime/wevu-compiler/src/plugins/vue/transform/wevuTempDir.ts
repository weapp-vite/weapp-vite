import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import process from 'node:process'
import path from 'pathe'

const PROJECT_WEVU_CONFIG_DIR = path.join('.weapp-vite', 'wevu-config')

/**
 * 优先把临时配置缓存放到项目内，避免宏求值时脱离项目根目录导致包名导入解析异常。
 */
function getWevuConfigCacheRoot() {
  const env = process.env.WEAPP_VITE_WEVU_CONFIG_DIR?.trim()
  if (env) {
    return path.resolve(env)
  }

  const cwd = process.cwd()
  const projectRoot = cwd
  if (fs.existsSync(projectRoot)) {
    return path.join(projectRoot, PROJECT_WEVU_CONFIG_DIR)
  }

  return path.join(os.tmpdir(), 'weapp-vite', 'wevu-config')
}

export function resolveWevuConfigTempDir(fromDir: string) {
  const root = getWevuConfigCacheRoot()
  const key = createHash('sha256')
    .update(path.normalize(fromDir))
    .digest('hex')
    .slice(0, 8)
  return path.join(root, key)
}
