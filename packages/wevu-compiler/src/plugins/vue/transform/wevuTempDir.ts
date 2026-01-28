import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import process from 'node:process'
import path from 'pathe'

function getWevuConfigCacheRoot() {
  const env = process.env.WEAPP_VITE_WEVU_CONFIG_DIR?.trim()
  if (env) {
    return path.resolve(env)
  }

  const cwd = process.cwd()
  const nodeModulesDir = path.join(cwd, 'node_modules')
  if (fs.existsSync(nodeModulesDir)) {
    return path.join(nodeModulesDir, '.cache', 'weapp-vite', 'wevu-config')
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
