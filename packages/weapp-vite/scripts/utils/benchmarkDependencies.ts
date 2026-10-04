import { mkdir, readdir, rm, stat, symlink } from 'node:fs/promises'
import path from 'pathe'

export async function linkBenchmarkDependencies(projectRoot: string, workspaceRootNodeModulesDir: string, workspaceWeappViteDir: string) {
  const projectNodeModulesDir = path.join(projectRoot, 'node_modules')
  // 依赖目录由当前 fixture 独占，候选包别名不能通过父目录链接写回共享安装。
  await mkdir(projectNodeModulesDir)

  try {
    const entries = await readdir(workspaceRootNodeModulesDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === 'weapp-vite') {
        continue
      }
      const dependencyPath = path.resolve(workspaceRootNodeModulesDir, entry.name)
      if (entry.isDirectory() || (entry.isSymbolicLink() && (await stat(dependencyPath)).isDirectory())) {
        await symlink(dependencyPath, path.join(projectNodeModulesDir, entry.name), 'junction')
      }
    }

    await symlink(path.resolve(workspaceWeappViteDir), path.join(projectNodeModulesDir, 'weapp-vite'), 'junction')
  }
  catch (error) {
    await rm(projectNodeModulesDir, { recursive: true, force: true })
    throw error
  }
}
