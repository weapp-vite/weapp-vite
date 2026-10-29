import type { VerificationPlan, VerificationReport } from '../types.ts'
import { mkdir, mkdtemp, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 同一执行器负责快照 worker 和取消传播。
import { execa } from 'execa'
import { verificationGitArgs } from '../git.ts'
import { getResourceBudget } from '../resources.ts'
import { packageManagerEnvironment } from '../toolchain.ts'
import { resolveVerificationTopology } from '../topology.ts'
import { clearedGitEnvironment } from './git.ts'
import { withPushLease } from './lease.ts'
import { pushReceiptKey, readPushReceipt, writePushReceipt } from './receipts.ts'
import { parsePushRefs, resolvePushTargets } from './refs.ts'
import { withPushSnapshot } from './snapshot.ts'

export interface PushOptions {
  base?: string
  jobs?: string
  signal?: AbortSignal
}

/** 本地回执只减少同候选推送重试；全部 PR 原生门禁仍由 CI 独立执行。 */
export async function verifyPush(root: string, input: string, options: PushOptions = {}): Promise<void> {
  const refs = parsePushRefs(input)
  if (!refs.length) {
    return
  }
  const env = await clearedGitEnvironment(root)
  const git = async (args: string[]) => (await execa('git', verificationGitArgs(args), { cwd: root, env, cancelSignal: options.signal })).stdout
  const targets = await resolvePushTargets(refs, git, options.base)
  options.signal?.throwIfAborted()
  if (!targets.length) {
    process.stdout.write('pre-push: 没有需要验证的候选提交\n')
    return
  }
  await withPushLease(root, async () => {
    for (const target of targets) {
      options.signal?.throwIfAborted()
      const manifest = JSON.parse(await git(['show', `${target.head}:package.json`])) as { packageManager: string }
      const toolchain = await packageManagerEnvironment(manifest.packageManager, options.signal)
      const topology = resolveVerificationTopology()
      const budget = getResourceBudget({ jobs: options.jobs })
      const key = await pushReceiptKey(root, { target, toolchain, topology, jobs: budget.jobs, mode: 'quick', selection: 'affected' })
      const receipt = path.join(root, '.tmp/verification/pre-push/receipts', `${key}.json`)
      if (await readPushReceipt(receipt, key)) {
        process.stdout.write(`pre-push: 复用 ${target.head.slice(0, 12)} 的精确本地 quick 成功回执；CI 门禁仍须执行\n`)
        continue
      }
      process.stdout.write(`pre-push: 验证 ${target.remoteRef} ${target.head.slice(0, 12)} 的提交快照\n`)
      const { plan, report } = await withPushSnapshot({ root, head: target.head, env: { ...toolchain, ...env }, signal: options.signal }, async (directory) => {
        const parent = path.join(root, '.tmp/verification/pre-push/runs')
        await mkdir(parent, { recursive: true })
        const output = await mkdtemp(path.join(parent, 'quick-'))
        const args = ['--import', 'tsx', fileURLToPath(new URL('./worker.ts', import.meta.url)), '--root', directory, '--head', target.head, '--output', output, '--jobs', String(budget.jobs)]
        if (target.base) {
          args.push('--base', target.base)
        }
        // worker 收到取消后负责完成自身子任务收尾；不能在它仍持有快照时强制回收目录。
        await execa(process.execPath, args, { cwd: directory, env: { ...toolchain, ...env, INIT_CWD: directory, PNPM_SCRIPT_SRC_DIR: undefined }, stdio: 'inherit', cancelSignal: options.signal, forceKillAfterDelay: false })
        const plan = JSON.parse(await readFile(path.join(output, 'plan.json'), 'utf8')) as VerificationPlan
        const report = JSON.parse(await readFile(path.join(output, 'report.json'), 'utf8')) as VerificationReport
        return { plan, report }
      })
      if (await pushReceiptKey(root, { target, toolchain, topology, jobs: budget.jobs, mode: 'quick', selection: 'affected' }) !== key) {
        throw new Error('快检期间验证策略或环境发生变化，拒绝保存过期回执')
      }
      await writePushReceipt(receipt, key, target, plan, report)
    }
  })
}
