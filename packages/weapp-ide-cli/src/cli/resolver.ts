import fs from 'fs-extra'
import { getConfig } from '../config/resolver'

export async function resolveCliPath() {
  const config = await getConfig()

  if (!config.cliPath) {
    return { cliPath: null, source: config.source }
  }

  const exists = await fs.pathExists(config.cliPath)

  return {
    cliPath: exists ? config.cliPath : null,
    source: config.source,
  }
}
