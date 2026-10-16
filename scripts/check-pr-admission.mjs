import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { checkLiveAdmission } from './prAdmission/live.mjs'
import { checkLocalAdmission, readLocalAdmission } from './prAdmission/local.mjs'
import { exitCode, formatReport, incomplete } from './prAdmission/report.mjs'

/** 默认离线，线上查询必须由调用者显式选择，普通 CI 不需要管理权限。 */
export async function runPrAdmission(argv, { root = fileURLToPath(new URL('../', import.meta.url)), gh, write = value => process.stdout.write(value) } = {}) {
  const results = []
  try {
    const { values } = parseArgs({ args: argv, options: { live: { type: 'boolean' }, repo: { type: 'string' }, help: { type: 'boolean' } }, strict: true })
    if (values.help) {
      write('Usage: pnpm check:pr-admission [--live [--repo owner/repo]]\n默认检查本地 workflow；--live 额外只读核对 GitHub 审批保护。\n')
      return 0
    }
    if (values.repo !== undefined && (!values.live || !/^[\w.-]+\/[\w.-]+$/u.test(values.repo))) {
      throw new TypeError('--repo owner/repo 必须与 --live 一起使用')
    }
    const state = await readLocalAdmission(root)
    results.push(...checkLocalAdmission(state))
    if (values.live) {
      results.push(...await checkLiveAdmission(state.policy, { repository: values.repo, root, gh }))
    }
  }
  catch (error) {
    results.push(incomplete('准入核验', error.message))
  }
  write(`${formatReport(results)}\n`)
  const code = exitCode(results)
  write(`PR admission: ${code === 0 ? '通过' : code === 1 ? '发现规则偏离' : '核验未完成'}；${results.length} 项检查\n`)
  return code
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runPrAdmission(process.argv.slice(2))
}
