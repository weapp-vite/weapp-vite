import { fileURLToPath } from 'node:url'
import fs from 'fs-extra'
import path from 'pathe'
import { logger } from '../src/logger'
import { getTargets } from '../src/targets'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.join(__dirname, '../../..')
const assetsDir = path.join(__dirname, '../assets')

await fs.ensureDir(assetsDir)

const targets = getTargets()

for (const t of targets) {
  const from = path.resolve(rootDir, t)
  const to = path.resolve(assetsDir, t)
  if (t === '.husky') {
    await fs.copy(from, to, {
      filter(src) {
        return !/[\\/]_$/.test(src)
      },
    })
  }
  else {
    await fs.copy(from, to)
  }

  logger.success(to)
}

logger.success('prepare ok!')
