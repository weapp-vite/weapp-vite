import { cp, lstat, mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const fixtureEntries = new Set([
  'src',
  'public',
  'package.json',
  'project.config.json',
  'project.private.config.json',
  'tsconfig.json',
  'weapp-vite.config.ts',
  'vite.stateful.config.mts',
  'vite.plugin.config.mts',
  'index.html',
])
const generatedEntries = new Set(['node_modules', 'dist', '.cache', '.tmp', '.turbo', '.weapp-vite'])

/** 为 workspace HMR 验证复制独占项目；显式发布消费者项目不经过此入口。 */
export async function createStatefulHmrProject(repositoryRoot = ROOT) {
  const fixtureRoot = path.join(repositoryRoot, 'e2e-apps/stateful-hmr')
  const parent = path.join(repositoryRoot, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const projectRoot = await mkdtemp(path.join(parent, 'stateful-hmr-'))
  const identity = await lstat(projectRoot)
  let cleanupTask: Promise<void> | undefined
  const cleanup = () => cleanupTask ??= (async () => {
    const current = await lstat(projectRoot).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        return undefined
      }
      throw error
    })
    // 目录已被其他所有者替换时不能沿用旧路径清理；依赖链接也不能跟随删除。
    if (current?.isDirectory() && current.dev === identity.dev && current.ino === identity.ino) {
      await rm(projectRoot, { recursive: true, force: true })
    }
  })()
  try {
    await cp(fixtureRoot, projectRoot, {
      recursive: true,
      filter(source) {
        const relative = path.relative(fixtureRoot, source)
        const segments = relative.split(path.sep)
        return !relative || (fixtureEntries.has(segments[0]!) && !segments.some(segment => generatedEntries.has(segment)))
      },
    })
    await mkdir(path.join(projectRoot, 'node_modules'))
    for (const [name, relative] of [['weapp-vite', 'packages/weapp-vite'], ['wevu', 'packages-runtime/wevu']] as const) {
      await symlink(await realpath(path.join(repositoryRoot, relative)), path.join(projectRoot, 'node_modules', name), 'junction')
    }
    return { projectRoot, cleanup }
  }
  catch (error) {
    await cleanup()
    throw error
  }
}
