import process from 'node:process'
import path from 'pathe'
import { resolveRepoRoot, resolveWorkspaceNodeModulesDir } from '../../src/utils/workspace'

/** Windows 使用分号连接 PATH，不能把盘符冒号当作路径分隔符。 */
export function createBenchmarkPath(bin: string, current = process.env.PATH ?? '', platform: string = process.platform) {
  return `${bin}${platform === 'win32' ? ';' : ':'}${current}`
}

/** 固定驱动与 fixture，仅切换被测包和依赖目录；准备工作在计时前完成。 */
export function resolveBenchmarkTarget(scriptDirectory: string) {
  const workspaceRootDir = process.env.AUTO_IMPORT_BENCH_TARGET_ROOT
    ? path.resolve(process.env.AUTO_IMPORT_BENCH_TARGET_ROOT)
    : resolveRepoRoot(scriptDirectory)
  if (!workspaceRootDir) {
    throw new Error('Unable to locate benchmark checkout')
  }
  const workspaceRootNodeModulesDir = resolveWorkspaceNodeModulesDir(workspaceRootDir)
  if (!workspaceRootNodeModulesDir) {
    throw new Error('Unable to locate prepared benchmark dependencies')
  }
  return {
    workspaceRootDir,
    workspaceRootNodeModulesDir,
    workspaceWeappViteDir: path.join(workspaceRootDir, 'packages/weapp-vite'),
  }
}
