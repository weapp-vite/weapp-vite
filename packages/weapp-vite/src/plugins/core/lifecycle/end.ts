import type { CorePluginState } from '../helpers'
import { createDebugger } from '../../../debugger'

const debug = createDebugger('weapp-vite:core')

export function createBuildEndHook(state: CorePluginState) {
  const { subPackageMeta } = state

  return function buildEnd(this: any) {
    debug?.(`${subPackageMeta ? `独立分包 ${subPackageMeta.subPackage.root}` : '主包'} ${Array.from(this.getModuleIds()).length} 个模块被编译`)
  }
}
