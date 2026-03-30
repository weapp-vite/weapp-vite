import type { LoadConfigOptions } from './runtime/config/types'
import { lstat, mkdir, readlink, rm, symlink } from 'node:fs/promises'
import path from 'node:path'
import { getCompilerContext, resetCompilerContext, setActiveCompilerContextKey } from './context/getInstance'
import logger from './logger'
import { syncProjectSupportFiles } from './runtime/supportFiles'
import { syncManagedTsconfigBootstrapFiles } from './runtime/tsconfigSupport'

interface CreateCompilerContextOptions extends Partial<LoadConfigOptions> {
  key?: string
  syncSupportFiles?: boolean
}

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const TEST_FIXTURE_ROOT = path.resolve(REPO_ROOT, 'test/fixture-projects/weapp-vite')
const TEST_PLUGIN_DEMO_ROOT = path.resolve(REPO_ROOT, 'apps/plugin-demo')
const WEAPP_VITE_PACKAGE_DIR = path.resolve(REPO_ROOT, 'packages/weapp-vite')

async function ensureExternalTestProjectPackageStub(cwd: string) {
  if (process.env.__TEST__ !== 'true') {
    return
  }

  const normalizedCwd = path.resolve(cwd)
  const isFixtureProject = normalizedCwd === TEST_FIXTURE_ROOT || normalizedCwd.startsWith(`${TEST_FIXTURE_ROOT}${path.sep}`)
  const isPluginDemo = normalizedCwd === TEST_PLUGIN_DEMO_ROOT

  if (!isFixtureProject && !isPluginDemo) {
    return
  }

  const projectNodeModulesDir = path.join(normalizedCwd, 'node_modules')
  const packageRoot = path.join(projectNodeModulesDir, 'weapp-vite')
  const existingStat = await lstat(packageRoot).catch(() => null)

  if (existingStat?.isSymbolicLink()) {
    const currentTarget = await readlink(packageRoot).catch(() => '')
    if (path.resolve(projectNodeModulesDir, currentTarget) === WEAPP_VITE_PACKAGE_DIR) {
      return
    }
  }

  if (existingStat) {
    await rm(packageRoot, { recursive: true, force: true })
  }

  await mkdir(projectNodeModulesDir, { recursive: true })
  await symlink(path.relative(projectNodeModulesDir, WEAPP_VITE_PACKAGE_DIR), packageRoot, 'junction')
}

/**
 * @description 创建并初始化编译上下文（加载配置、扫描入口）
 */
export async function createCompilerContext(options?: CreateCompilerContextOptions) {
  let bootstrapManagedTsconfigChanged = false
  if (options?.cwd) {
    await ensureExternalTestProjectPackageStub(options.cwd)
    try {
      bootstrapManagedTsconfigChanged = await syncManagedTsconfigBootstrapFiles(options.cwd)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(`[tsconfig] 跳过 .weapp-vite 支持文件预生成：${message}`)
    }
  }
  // 先初始化 ConfigService
  const key = options?.key ?? 'default'
  if (!options?.key) {
    // 确保未显式传入 key 的调用方不会复用旧的全局上下文
    resetCompilerContext(key)
  }
  setActiveCompilerContextKey(key)
  const ctx = getCompilerContext(key)
  const { configService, scanService } = ctx
  await configService.load(options)
  if (options?.syncSupportFiles !== false) {
    try {
      const supportFiles = await syncProjectSupportFiles(ctx)
      if (bootstrapManagedTsconfigChanged || supportFiles.managedTsconfigChanged) {
        logger.warn('[prepare] 检测到 .weapp-vite 支持文件缺失或已过期，已自动重新生成。建议执行 weapp-vite prepare 并提交更新。')
      }
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(`[prepare] 自动同步 .weapp-vite 支持文件失败：${message}`)
    }
  }
  // 预检
  try {
    await scanService.loadAppEntry()
  }
  catch {
    // 预检失败时忽略
  }

  return ctx
}
