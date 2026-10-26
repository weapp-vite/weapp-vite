import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 跨平台解析 pnpm shim，并保留文件名的独立 argv 边界。
import { execaSync } from 'execa'
import { selectStagedFiles, stagedFiles } from './files.mjs'

const root = execaSync('git', ['rev-parse', '--show-toplevel']).stdout
const selected = selectStagedFiles(stagedFiles(root))
/** @type {(command: string, args: string[]) => unknown} */
const run = (command, args) => execaSync(command, args, { cwd: root, stdio: 'inherit', preferLocal: true })
/** @type {(script: string, args?: string[]) => unknown} */
const node = (script, args = []) => run(process.execPath, [path.join(root, script), ...args])
/** @type {(args: string[]) => unknown} */
const pnpm = args => run('pnpm', args)

switch (process.argv[2]) {
  case 'semantic':
    node('scripts/dom-inventory-policy.mjs')
    node('scripts/check-changeset-frontmatter.mjs', ['--staged', '--root', root])
    break
  case 'contracts':
    if (selected.e2e) {
      pnpm(['e2e:dom-acceptance:check'])
    }
    if (selected.skillsYaml) {
      node('skills/scripts/validate-skills-yaml.mjs')
    }
    if (selected.skillsSync) {
      node('skills/scripts/check-public-skill-sync.mjs')
    }
    break
  case 'eslint':
    if (selected.changesets.length) {
      pnpm(['exec', 'eslint', '--fix', '--no-ignore', '--max-warnings=0', '--no-warn-ignored', '--', ...selected.changesets])
    }
    if (selected.eslint.length) {
      pnpm(['exec', 'eslint', '--fix', '--max-warnings=0', '--no-warn-ignored', '--', ...selected.eslint])
    }
    break
  case 'stylelint':
    if (selected.styles.length) {
      pnpm(['exec', 'stylelint', '--fix', '--allow-empty-input', '--', ...selected.styles])
    }
    break
  case 'project-configs':
    if (selected.projectConfigs.length) {
      node('scripts/fix-wechat-devtools-project-config-eof.mjs', selected.projectConfigs)
    }
    break
  default:
    throw new Error(`Unknown staged hook: ${process.argv[2]}`)
}
