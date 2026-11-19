import { readFile, symlink } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 仓库 CLI 回归统一使用跨平台进程封装。
import { execa } from 'execa'
import { prepareAuthorIssueFixture } from './authorIssueFixture'
import { sanitizeBuildCommandEnv } from './buildCommandEnv'

export const NPM_ARTIFACT_FIXTURE = 'e2e-apps/github-issues/fixtures/issues-1355-1356'
const CLI = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')

/** 按 issue 描述构造隔离的本地原生 npm 包，避免依赖安装布局影响复现。 */
export async function prepareNpmArtifactFixture() {
  const project = await prepareAuthorIssueFixture(NPM_ARTIFACT_FIXTURE)
  await symlink(path.join(project, 'mini-lib'), path.join(project, 'node_modules/mini-lib'), 'junction')
  return project
}

/** 用公共 CLI 验证模式和输出参数，并保留用户插件的阶段观察结果。 */
export async function buildNpmArtifactFixture(project: string, outDir: string, mode = 'demo') {
  const result = await execa(process.execPath, [CLI, 'build', '--mode', mode, '--outDir', outDir], {
    cwd: project,
    env: sanitizeBuildCommandEnv(),
    extendEnv: false,
    all: true,
  })
  const observations = JSON.parse(await readFile(path.join(project, 'hook-observations.json'), 'utf8')) as {
    writeBundle: boolean
    closeBundle: boolean
  }
  return { output: path.resolve(project, outDir), observations, log: result.all }
}
