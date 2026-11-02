import type { WorkspacePackage } from './types.ts'

/** 库源码边界与最终消费者分开；全局失效不能改变文件的真实 owner。 */
export function isLibraryPackage(item: WorkspacePackage): boolean {
  return /^(?:packages|packages-runtime|@weapp-core|mpcore\/packages)\//.test(item.directory)
}

/** 安装期 prepare 允许跳过，拥有源码的消费者验证必须在 dist 就绪后重新准备。 */
export function needsConsumerPrepare(item: WorkspacePackage): boolean {
  return !isLibraryPackage(item) && Boolean(item.scripts.typecheck || item.scripts.test || item.scripts['test:pure'])
    && (item.scripts.typecheck?.includes('.weapp-vite/') === true || /\b(?:wv|weapp-vite)\s+prepare\b/.test(item.scripts.postinstall ?? ''))
}

/** quick 只执行库级检查及真实拥有变更的消费者快检，影响闭包继续保留给 review/CI。 */
export function quickCheckPackages(selected: WorkspacePackage[], owned: Set<string>): WorkspacePackage[] {
  return selected.filter(item => isLibraryPackage(item) || owned.has(item.name))
}

/** 显式 E2E 留给受管入口，源码 runtime 和嵌套工具 e2e 目录中的普通单测继续保留。 */
export function isQuickUnitTest(item: WorkspacePackage, file: string): boolean {
  return !file.startsWith(`${item.directory}/e2e/`) && !/\.e2e\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)
}

/** dist 准备以实际检查为根，不把全局 extraInputs 当成直接消费者构建授权。 */
export function quickBuildRoots(selected: WorkspacePackage[], owned: Set<string>, tested: Set<string>): WorkspacePackage[] {
  return quickCheckPackages(selected, owned).filter(item => item.scripts.typecheck
    || tested.has(item.name))
}
