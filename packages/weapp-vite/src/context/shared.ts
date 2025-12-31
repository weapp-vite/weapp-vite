import path from 'pathe'
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

function resolvedComponentName(entry: string): { componentName?: string, base: string } {
  // 示例：
  // - components/HelloWorld/index.ts => HelloWorld
  // - components/HelloWorld/HelloWorld.ts => HelloWorld
  const base = path.basename(entry)
  if (base === 'index') {
    const dirName = path.dirname(entry)
    if (dirName === '.') {
      return {
        base,
      }
    }
    return {
      componentName: path.basename(dirName),
      base,
    }
  }
  return {
    componentName: base,
    base,
  }
}

function isEmptyObject(obj: any) {
  for (const key in obj) {
    if (Object.hasOwn(obj, key)) {
      return false
    }
  }
  return true
}

export {
  debug,
  isEmptyObject,
  logBuildIndependentSubPackageFinish,
  logger,
  resolvedComponentName,
}
