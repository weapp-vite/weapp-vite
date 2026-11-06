import { glob, readFile } from 'node:fs/promises'
import path from 'node:path'

export const ROOT_REPOSITORY_TEST_GLOBS = ['scripts/**/*.test.ts', 'integrations/shared-hmr-tailwind/**/*.test.ts']
export const SCRIPT_TEST_GLOBS = ['scripts/**/*.test.mjs', 'scripts/**/*.test.ts']

/** 真实外部子进程夹具独占串行分组，避免与其他项目争用启动和执行资源。 */
export const REPOSITORY_SUBPROCESS_TEST_FILES = [
  'scripts/check-changeset-frontmatter.test.ts',
  'scripts/verification/build.test.ts',
  'scripts/verification/changes.test.ts',
  'scripts/verification/prePush/snapshot.test.ts',
  'scripts/verifyVitePlusTemplates/publicTypes.test.ts',
]

/** 受管测试自行取得机器租约并启动真实资源，分类不改变完整入口的发现范围。 */
const MANAGED_SCRIPT_TESTS = new Set([
  'scripts/dependencyContracts/vite.test.ts',
  'scripts/performanceGate/devShutdown.integration.test.ts',
])

/** 根入口与独立工具入口共用发现规则，补集和并集都按真实文件去重。 */
export async function scriptTestInventory(root: string): Promise<{ all: string[], root: Set<string>, managed: Set<string> }> {
  const all: string[] = []
  for await (const file of glob(SCRIPT_TEST_GLOBS, { cwd: root, exclude: ['**/node_modules/**', '**/.git/**'] })) {
    all.push(file.replaceAll('\\', '/'))
  }
  return {
    all: [...new Set(all)].sort(),
    root: new Set(all.filter(file => ROOT_REPOSITORY_TEST_GLOBS.some(pattern => path.posix.matchesGlob(file, pattern)))),
    managed: new Set(all.filter(file => MANAGED_SCRIPT_TESTS.has(file))),
  }
}

/** 工作流清单仍来自正式入口；无法安全展开时停止，不猜测或丢弃额外命令。 */
export async function workflowContractInventory(root: string, inventory: string[]): Promise<string[]> {
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as { scripts?: Record<string, string> }
  const script = manifest.scripts?.['test:pr-actions'] ?? ''
  if (!script) {
    return inventory
  }
  const prefix = 'vitest run --config scripts/vitest.config.mjs '
  if (!script.startsWith(prefix) || /[;&|"'`$]/.test(script)) {
    throw new Error('无法安全展开 test:pr-actions 工具测试清单，请更新验证任务归属')
  }
  const filters = script.slice(prefix.length).trim().split(/\s+/)
  if (filters.some(filter => !filter.startsWith('scripts/') || filter.includes('..') || filter.includes('\\') || filter.startsWith('-'))) {
    throw new Error('test:pr-actions 包含未归属的工具测试范围')
  }
  const matches = (file: string, filter: string) => file === filter || file.startsWith(`${filter}/`)
  if (filters.some(filter => !inventory.some(file => matches(file, filter)))) {
    throw new Error('test:pr-actions 清单包含不存在的工具测试')
  }
  return inventory.filter(file => filters.some(filter => matches(file, filter)))
}
