import { createDebugger } from '../debugger'
import logger from '../logger'

const debug = createDebugger('weapp-vite:context')

let once = false
function logBuildIndependentSubPackageFinish(root: string) {
  if (!once) {
    logger.success(`独立分包 ${root} 构建完成！`)
    once = true
  }
}

export {
  debug,
  logBuildIndependentSubPackageFinish,
  logger,
}
