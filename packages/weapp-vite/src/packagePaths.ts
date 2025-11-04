import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'fs-extra'

function findPackageRoot(from: string) {
  let current = from
  while (true) {
    if (fs.existsSync(join(current, 'package.json'))) {
      return current
    }
    const parent = dirname(current)
    if (parent === current) {
      break
    }
    current = parent
  }

  throw new Error('无法定位 weapp-vite 包根目录，请检查安装路径。')
}

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url))

export const PACKAGE_ROOT = findPackageRoot(CURRENT_DIR)
export const ANALYZE_DASHBOARD_ROOT = join(PACKAGE_ROOT, 'modules/analyze-dashboard')
