import { access, writeFile } from 'node:fs/promises'
import path from 'node:path'

const WORKSPACE_CONFIG = `packages: []

# 仅允许模板依赖中需要的安装脚本，新增依赖仍需单独审批。
allowBuilds:
  '@swc/core': true
  '@weapp-tailwindcss/merge': true
  oxc-resolver: true
  rolldown: true

  # 使用 registry 内的预编译包，避免额外下载或本机源码编译。
  '@parcel/watcher': false
  esbuild: false
  weapp-tailwindcss: false
`

/** 从目标目录向上查找 pnpm 实际使用的最近工作区边界。 */
export async function findPnpmWorkspaceRoot(root: string): Promise<string | undefined> {
  let current = path.resolve(root)
  while (true) {
    try {
      await access(path.join(current, 'pnpm-workspace.yaml'))
      return current
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
    const parent = path.dirname(current)
    if (parent === current) {
      return undefined
    }
    current = parent
  }
}

/** 为独立新项目生成 pnpm 构建审批，原样保留已有团队配置。 */
export async function ensurePnpmBuildPolicy(root: string) {
  if (await findPnpmWorkspaceRoot(root)) {
    return
  }

  try {
    await writeFile(path.join(root, 'pnpm-workspace.yaml'), WORKSPACE_CONFIG, { flag: 'wx' })
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
  }
}
