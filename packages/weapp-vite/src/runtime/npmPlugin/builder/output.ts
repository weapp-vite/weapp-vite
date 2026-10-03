import type { NpmBuildOptions } from '../../../types'

/** 宿主接管输出时，回调仍接收最终路径；原生目录仅在内部映射到中间目录。 */
export interface PackageBuildOutput {
  directory: (outDir: string) => string
  bundle: (options: NpmBuildOptions, outDir: string) => Promise<void>
  watchFile?: (fileName: string) => void
}

/** 等待递归依赖全部退出，失败不能让兄弟任务越过中间目录的生命周期。 */
export async function settlePackageBuilds(tasks: Promise<unknown>[]) {
  const results = await Promise.allSettled(tasks)
  const failure = results.find(result => result.status === 'rejected')
  if (failure?.status === 'rejected') {
    throw failure.reason
  }
}
