import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 跨平台解析 pnpm shim，并保留文件名的独立 argv 边界。
import { execaSync } from 'execa'

/** 只迁移本仓库的旧 Husky 配置，保留用户自定义或全局 hooksPath。 */
export function installHooks(cwd = process.cwd()) {
  if (process.env.CI || process.env.LEFTHOOK === '0') {
    return
  }
  const rootResult = execaSync('git', ['rev-parse', '--show-toplevel'], { cwd, reject: false })
  if (rootResult.exitCode !== 0) {
    return
  }
  const root = rootResult.stdout
  // 移除局部旧值后重新读取，不能覆盖重新显露的全局/系统自定义 hook。
  while (true) {
    const configured = execaSync('git', ['config', '--show-scope', '--get', 'core.hooksPath'], { cwd: root, reject: false })
    if (configured.exitCode === 1) {
      break
    }
    if (configured.exitCode !== 0) {
      throw new Error(`Cannot read core.hooksPath: ${configured.stderr}`)
    }
    const separator = configured.stdout.indexOf('\t')
    const scope = configured.stdout.slice(0, separator)
    const hooksPath = separator < 0 ? '' : configured.stdout.slice(separator + 1).replaceAll('\\', '/')
    const owned = ['.husky', '.husky/_', `${root.replaceAll('\\', '/')}/.husky`, `${root.replaceAll('\\', '/')}/.husky/_`].includes(hooksPath ?? '')
    if (owned && (scope === 'local' || scope === 'worktree')) {
      execaSync('git', ['config', scope === 'worktree' ? '--worktree' : '--local', '--unset-all', 'core.hooksPath'], { cwd: root })
    }
    else {
      console.warn('[hooks] 保留自定义 core.hooksPath；请在现有 hook 中接入 pnpm exec lefthook run。')
      return
    }
  }
  execaSync('pnpm', ['exec', 'lefthook', 'install'], { cwd: root, stdio: 'inherit', preferLocal: true })
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  installHooks()
}
