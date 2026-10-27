import type { GithubIssuesBuildCaseContext } from '../cases/types'
import type { GithubIssuesBuildGroup } from '../groups'
import { runBuild, runBuildWithSourcemap } from './build/standard'
import { APP_ROOT, CLI_PATH, DIST_ROOT } from './constants'

/** 独立 sourcemap 任务共用一次真实构建；旧聚合入口保留原构建次序。 */
export function createGithubIssuesBuildCaseContext(group?: GithubIssuesBuildGroup): GithubIssuesBuildCaseContext {
  let sourcemapBuild: Promise<void> | undefined
  return {
    appRoot: APP_ROOT,
    cliPath: CLI_PATH,
    distRoot: DIST_ROOT,
    runStandardBuild: runBuild,
    ...(group === 'sourcemap'
      ? { runSourcemapBuild: () => sourcemapBuild ??= runBuildWithSourcemap() }
      : {}),
  }
}
