import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import picomatch from 'picomatch'
import { parse } from 'yaml'

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

/** 按成员目录规则查找目标项目所属的最近工作区，不越过独立工作区。 */
export async function findPnpmWorkspaceRoot(root: string): Promise<string | undefined> {
  const target = path.resolve(root)
  let current = target
  while (true) {
    try {
      const content = await readFile(path.join(current, 'pnpm-workspace.yaml'), 'utf8')
      const relative = path.relative(current, target).split(path.sep).join('/')
      if (!relative) {
        return current
      }
      const config = parse(content) as { packages?: string[] } | null
      const patterns = (config?.packages ?? []).map(pattern => pattern.replace(/\/+$/, ''))
      const included = patterns.filter(pattern => !pattern.startsWith('!'))
      const excluded = patterns.filter(pattern => pattern.startsWith('!')).map(pattern => pattern.slice(1))
      const matches = included.length > 0 && picomatch(included, { dot: true, ignore: excluded })(relative)
      return matches ? current : undefined
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
