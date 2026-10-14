import type { Browser, CDPSession } from 'playwright'
import { randomUUID } from 'node:crypto'
import { mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { cacheRoot } from '../../../packages-private/dimina-playground/config'
import { diagnosticBudget } from './budget'
import { createWindowsSampler } from './windows'
import { createEvidenceWriter, diagnosticError, DIAGNOSTICS_ENV, HOST_EVIDENCE_ENV } from './writer'

/** 默认关闭；仅日志参数进入 Chromium，既不预热也不改变网络功能。 */
export function diagnosticLaunchOptions(directory: string) {
  return { args: [`--log-net-log=${path.join(directory, 'netlog.json')}`, '--net-log-capture-mode=Default'] }
}

export async function startDiagnostics(mode: string) {
  if (process.env[DIAGNOSTICS_ENV] !== '1') {
    return undefined
  }
  try {
    const directory = path.join(cacheRoot, 'diagnostics', `${mode}-${randomUUID()}`)
    await mkdir(directory, { recursive: true })
    const writer = createEvidenceWriter(path.join(directory, 'events.jsonl'), path.join(directory, 'errors.json'))
    const pids = new Set<number>()
    const sampler = createWindowsSampler(event => writer.record(event))
    let navigationStarted = false
    let finished: Promise<void> | undefined
    let browserClosed = false
    const mark = (phase: string, detail: Record<string, unknown> = {}) => {
      writer.record({ event: 'phase', phase, ...detail })
      sampler.sample(phase, [...pids])
    }
    mark('before-browser', { mode, node: process.version, platform: process.platform, pid: process.pid })
    return {
      launchOptions: diagnosticLaunchOptions(directory),
      hostEnvironment: { [HOST_EVIDENCE_ENV]: path.join(directory, 'host.jsonl') },
      mark,
      recordError(phase: string, error: unknown) {
        writer.record({ event: 'original-error', phase, error: diagnosticError(error) })
      },
      navigationStart(testName: string) {
        if (!navigationStarted) {
          navigationStarted = true
          mark('first-navigation', { testName })
        }
      },
      hostStarted(pid: number | undefined) {
        if (pid) {
          pids.add(pid)
        }
        mark('host-ready', { pid })
      },
      hostExited(detail: Record<string, unknown>) {
        writer.record({ event: 'host-exit', ...detail })
      },
      hostStderr(text: string) {
        writer.record({ event: 'host-stderr', text: text.slice(0, 6000) })
      },
      browserClosed() {
        browserClosed = true
        writer.record({ event: 'browser-closed' })
      },
      async browserConnected(browser: Browser) {
        let session: CDPSession | undefined
        const withinBudget = diagnosticBudget(1500)
        const cleanupWithinBudget = diagnosticBudget()
        try {
          writer.record({ event: 'browser-version', version: browser.version() })
          let opening: Promise<CDPSession> | undefined
          try {
            session = await withinBudget(() => {
              opening = browser.newBrowserCDPSession()
              return opening
            })
          }
          catch (error) {
            // 迟到的本任务协议会话仍须释放；所属 browser 的正常关闭是最终收尾。
            void opening?.then(late => late.detach()).catch(lateError => writer.onError('late-browser-identity', lateError))
            throw error
          }
          for (const method of ['Browser.getVersion', 'Browser.getBrowserCommandLine', 'SystemInfo.getProcessInfo'] as const) {
            try {
              const currentSession = session
              const result = await withinBudget(() => currentSession.send(method))
              writer.record({ event: 'browser-protocol', method, result })
              if ('processInfo' in result) {
                for (const info of result.processInfo) {
                  if (Number.isSafeInteger(info.id) && info.id > 0) {
                    pids.add(info.id)
                  }
                }
              }
            }
            catch (error) {
              writer.onError(method, error)
            }
          }
        }
        catch (error) {
          writer.onError('browser-identity', error)
        }
        finally {
          if (session) {
            // detach 始终发给本任务会话；等待仍受同一整体诊断 deadline 约束。
            const detached = session.detach()
            await cleanupWithinBudget(() => detached).catch(error => writer.onError('detach-browser-identity', error))
          }
        }
        mark('browser-connected')
      },
      finish() {
        finished ??= (async () => {
          try {
            mark('mode-finished')
            await sampler.stop()
            const netlog = await stat(path.join(directory, 'netlog.json')).catch((error) => {
              writer.onError('netlog-stat', error)
              return undefined
            })
            writer.record({ event: 'netlog-file', bytes: netlog?.size, flushedAfterBrowserClose: browserClosed })
          }
          catch (error) {
            writer.onError('finish-diagnostics', error)
          }
          await writer.flush()
        })()
        return finished
      },
    }
  }
  catch (error) {
    // eslint-disable-next-line no-console -- 无法建立证据目录不能替换原启动结果。
    console.error('[dimina-diagnostics]', { phase: 'start', error: diagnosticError(error) })
    return undefined
  }
}

export type DiminaDiagnostics = Awaited<ReturnType<typeof startDiagnostics>>

/** 宿主与浏览器独立收尾，保留首错；诊断失败只归档，不覆盖资源清理结果。 */
export async function cleanupModeResources(options: {
  closeBrowser?: () => Promise<void>
  stopHost: () => Promise<void>
  diagnostics?: Pick<NonNullable<DiminaDiagnostics>, 'recordError' | 'browserClosed' | 'finish'>
}) {
  const errors: unknown[] = []
  if (options.closeBrowser) {
    try {
      await options.closeBrowser()
      options.diagnostics?.browserClosed()
    }
    catch (error) {
      errors.push(error)
      options.diagnostics?.recordError('browser-close', error)
    }
  }
  try {
    await options.stopHost()
  }
  catch (error) {
    errors.push(error)
    options.diagnostics?.recordError('host-stop', error)
  }
  await options.diagnostics?.finish().catch(error => options.diagnostics?.recordError('diagnostic-teardown', error))
  if (errors.length === 1) {
    throw errors[0]
  }
  if (errors.length > 1) {
    throw new AggregateError(errors, 'Dimina browser and host cleanup failed', { cause: errors[0] })
  }
}
