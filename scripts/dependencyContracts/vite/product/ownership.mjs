import { createHash } from 'node:crypto'
import process from 'node:process'
import { failProductReport } from '../../report.mjs'

// 完整串行清单共享总监督预算，各场景自己的等待门限保持原值。
export const viteProductTimeoutMs = 300_000

export class ViteProductTerminationError extends Error {}

/** 只在 fixture 全部终结后完成 scope；超时或收尾未知时保留绑定证据并非零退出。 */
export async function withViteProductOwnership(lease, {
  reportFile,
  report,
  execute,
  pendingFixtures,
  persist,
  timeoutMs = viteProductTimeoutMs,
  exit = code => process.exit(code),
  signals = process,
}) {
  const cleanupKey = `vite-product:${JSON.stringify({ reportFile, pid: process.pid })}`
  const bindingSha256 = createHash('sha256').update(cleanupKey).digest('hex')
  const scope = await lease.createChildScope({ cleanupKey })
  report.ownership = { domain: 'vite-product', bindingSha256, pid: process.pid, scope: 'active' }
  const interruption = Promise.withResolvers()
  let termination
  let timer
  const preserve = (status, error, exitCode) => {
    termination ??= (async () => {
      clearTimeout(timer)
      Object.assign(report, failProductReport(report, error), { status })
      report.cleanup = { status: 'unconfirmed', fixture: 'preserved', lease: 'preserved', pendingFixtures: pendingFixtures(), bindingSha256 }
      try {
        await scope.seal()
        report.ownership.scope = 'sealed'
      }
      catch (sealError) {
        report.cleanup.sealError = { message: String(sealError), stack: sealError?.stack }
      }
      report.finishedAt = new Date().toISOString()
      try {
        await persist()
      }
      catch (reportError) {
        console.error('Could not persist the incomplete Vite product report:', reportError)
      }
      exit(exitCode)
      // 测试替身可以返回；不能因此继续完成尚未确认的 scope。
      throw new ViteProductTerminationError('Vite product resources did not confirm termination', { cause: error })
    })()
    void termination.catch(error => interruption.reject(error))
    return termination
  }
  const onSigint = () => {
    void preserve('interrupted', new Error('Vite product received SIGINT'), 130)
  }
  const onSigterm = () => {
    void preserve('interrupted', new Error('Vite product received SIGTERM'), 143)
  }
  signals.once('SIGINT', onSigint)
  signals.once('SIGTERM', onSigterm)
  timer = setTimeout(() => {
    void preserve('timeout', new Error('Vite product supervisor timeout'), 2)
  }, timeoutMs)
  let failure
  try {
    try {
      await Promise.race([Promise.resolve().then(execute), interruption.promise])
    }
    catch (error) {
      failure = { error }
    }
    if (termination) {
      return await termination
    }
    if (pendingFixtures().length) {
      return await preserve('failed', failure ? failure.error : new Error('Vite product fixtures remain unconfirmed'), 1)
    }
    try {
      await scope.seal()
      report.ownership.scope = 'sealed'
      if (termination) {
        return await termination
      }
      await scope.complete()
      if (termination) {
        return await termination
      }
      report.ownership.scope = 'completed'
      report.cleanup = { status: 'confirmed', fixtures: [], scope: 'completed' }
    }
    catch (error) {
      if (termination) {
        return await termination
      }
      return await preserve('failed', failure
        ? new AggregateError([failure.error, error], 'Vite product execution and scope cleanup failed', { cause: failure.error })
        : error, 1)
    }
    if (failure) {
      throw failure.error
    }
  }
  finally {
    clearTimeout(timer)
    signals.off('SIGINT', onSigint)
    signals.off('SIGTERM', onSigterm)
  }
}
