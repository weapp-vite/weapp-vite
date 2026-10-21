import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const checker = path.join(repoRoot, 'scripts/check-changeset-frontmatter.mjs')
const copiedFiles = [
  '.husky/pre-commit',
  'lint-staged.config.js',
  'scripts/check-changeset-frontmatter.mjs',
  'scripts/changesetFrontmatter/input.mjs',
  'scripts/dom-inventory-policy.mjs',
]

export const valid = (summary = 'fix: 修复首次挂载', name = '@scope/known') => `---\n"${name}": patch\n---\n\n${summary}\n`
export const invalid = valid('修复首次挂载')

export function createGitFixture(hooks = false) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'changeset staged '))
  const root = path.join(directory, 'repository with spaces')
  const env = { ...process.env }
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'GIT_PREFIX']) {
    delete env[key]
  }
  // Git for Windows 不接受 Node 的设备路径；普通空文件同样隔离用户全局配置。
  env.GIT_CONFIG_GLOBAL = path.join(directory, 'empty.gitconfig')
  fs.writeFileSync(env.GIT_CONFIG_GLOBAL, '')
  env.GIT_CONFIG_NOSYSTEM = '1'
  env.PATH = `${path.join(repoRoot, 'node_modules/.bin')}${path.delimiter}${env.PATH}`

  const write = (file: string, content: string, cwd = root) => {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true })
    fs.writeFileSync(path.join(cwd, file), content)
  }
  const git = (args: string[], cwd = root) => execFileSync('git', ['-c', 'core.fsmonitor=false', ...args], { cwd, env, encoding: 'utf8' })
  const run = (command: string, args: string[], cwd = root) => spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout: 60_000 })
  const check = (staged = true, cwd = root) => run(process.execPath, [checker, '--root', cwd, ...(staged ? ['--staged'] : [])], cwd)
  const commit = (cwd = root) => run('git', ['-c', 'core.fsmonitor=false', 'commit', '--quiet', '-m', 'test: 检查暂存合约'], cwd)
  const installDependencies = (cwd = root) => fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(cwd, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  const enableHooks = () => git(['config', 'core.hooksPath', '.husky'])

  write('package.json', '{"name":"fixture","private":true,"type":"module"}\n')
  write('pnpm-workspace.yaml', 'packages:\n  - packages/*\n')
  write('packages/known/package.json', '{"name":"@scope/known"}\n')
  write('.changeset/README.md', '贡献说明不属于 changeset。\n')
  write('.gitignore', '/node_modules\n/e2e/dom-acceptance-inventory.json\n/e2e/dom-acceptance-inventory.md\n')
  git(['init', '--quiet', '--template='])
  git(['config', 'user.name', 'Changeset Gate Test'])
  git(['config', 'user.email', 'changeset-gate@example.invalid'])
  git(['config', 'commit.gpgsign', 'false'])
  git(['config', 'core.autocrlf', 'false'])
  if (hooks) {
    for (const file of copiedFiles) {
      write(file, fs.readFileSync(path.join(repoRoot, file), 'utf8'))
    }
    fs.chmodSync(path.join(root, '.husky/pre-commit'), 0o755)
    write('eslint.config.mjs', `export default [{
      files: ['**/*.md'],
      plugins: { fixture: { processors: { text: { preprocess: () => [], postprocess: () => [] } } } },
      processor: 'fixture/text',
    }]\n`)
    installDependencies()
  }
  git(['add', '.'])

  return {
    root,
    directory,
    env,
    write,
    git,
    run,
    check,
    commit,
    installDependencies,
    enableHooks,
    cleanup: () => fs.rmSync(directory, { recursive: true, force: true }),
    assertResult: (result: ReturnType<typeof run>, status: number) => assert.equal(result.status, status, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`),
  }
}
