import { fs } from '@weapp-core/shared/node'
import path from 'pathe'

export async function createIssue892ProjectConfig(appRoot: string, mode: 'build' | 'dev') {
  const sourceConfig = await fs.readJSON(path.join(appRoot, 'project.config.json')) as Record<string, unknown>
  const configRoot = path.join(appRoot, '.weapp-vite')
  await fs.ensureDir(configRoot)
  const tempRoot = await fs.mkdtemp(path.join(configRoot, 'issue-892-'))
  const outDir = mode === 'build' ? 'dist-issue-892' : 'dist-issue-892-dev'
  const projectConfigFile = path.join(tempRoot, 'project.config.json')
  try {
    // 实际小程序输出由 miniprogramRoot 决定，不能只改变日志工具的清理路径。
    await fs.writeJSON(projectConfigFile, {
      ...sourceConfig,
      miniprogramRoot: outDir,
    }, { spaces: 2 })
  }
  catch (error) {
    await fs.remove(tempRoot)
    throw error
  }
  return {
    outDir,
    distRoot: path.join(appRoot, outDir),
    projectConfigFile,
    cleanup: () => fs.remove(tempRoot),
  }
}
