import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { resolveIdeWarningReportPathsFromEnv } from './ideWarningReport'

const TRACE_ENV = 'WEAPP_VITE_E2E_DEV_PROCESS_TRACE'
const TRACE_DIR_ENV = 'WEAPP_VITE_E2E_DEV_PROCESS_TRACE_DIR'

export type DevProcessOutputStream = 'all' | 'stdout' | 'stderr'

interface DevProcessTraceExit {
  exitCode?: number | null
  signal?: string
  reason: 'process-exited' | 'spawn-failed'
}

/** 退出资源与原始输出沿用同一个报告目录，避免诊断产物脱离既有 CI 收集范围。 */
export function resolveDevProcessTraceDirectory(feature = TRACE_ENV) {
  const configuredDirectory = process.env[TRACE_DIR_ENV]?.trim()
  const reportPaths = configuredDirectory ? undefined : resolveIdeWarningReportPathsFromEnv()
  const directory = configuredDirectory || (reportPaths && path.join(reportPaths.reportDir, 'dev-process'))
  if (!directory) {
    throw new Error(`${feature}=1 requires an active IDE report or ${TRACE_DIR_ENV}.`)
  }
  return directory
}

/** 可选保留观测分块；序号不表示流间因果，最后一条 end 才是采集终态。 */
export function createDevProcessTrace(project: string) {
  if (process.env[TRACE_ENV] !== '1') {
    return undefined
  }
  const directory = resolveDevProcessTraceDirectory()
  fs.mkdirSync(directory, { recursive: true })
  const tracePath = path.join(directory, `${randomUUID()}.jsonl`)
  const descriptor = fs.openSync(tracePath, 'wx')
  let sequence = 0
  let closed = false
  let failure: Error | undefined
  let lateOutput = false
  let exitInfo: DevProcessTraceExit | undefined
  const failureCauses: unknown[] = []

  const retainFailure = (error: unknown) => {
    failure ??= new Error(`Dev process output trace is incomplete: ${tracePath}`, { cause: error })
    failureCauses.push(error)
    if (failureCauses.length > 1) {
      failure.cause = new AggregateError([...failureCauses], 'Dev output trace failures.')
    }
  }
  const append = (...events: Record<string, unknown>[]) => {
    try {
      const content = events.map(event => `${JSON.stringify({
        ...event,
        sequence: sequence++,
        observedAt: new Date().toISOString(),
      })}\n`).join('')
      if (closed) {
        fs.appendFileSync(tracePath, content, 'utf8')
      }
      else {
        fs.writeFileSync(descriptor, content, 'utf8')
      }
    }
    catch (error) {
      retainFailure(error)
    }
  }

  append({ kind: 'start', project })
  if (failure) {
    try {
      fs.closeSync(descriptor)
    }
    catch (error) {
      retainFailure(error)
    }
    throw failure
  }
  process.stdout.write(`[dev-process-trace] file=${JSON.stringify(tracePath)}\n`)

  return {
    path: tracePath,
    write(stream: DevProcessOutputStream, chunk: string | Uint8Array) {
      const event = {
        kind: 'chunk',
        stream,
        encoding: 'base64',
        data: (typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk)).toString('base64'),
      }
      if (closed) {
        if (!lateOutput) {
          lateOutput = true
          retainFailure(new Error('Output arrived after the trace ended.'))
        }
        append({ ...event, late: true }, {
          kind: 'end',
          exitCode: exitInfo?.exitCode,
          signal: exitInfo?.signal,
          status: 'incomplete',
          reason: 'late-output',
        })
        return
      }
      append(event)
    },
    close(exit: DevProcessTraceExit) {
      if (closed) {
        return
      }
      exitInfo = { exitCode: exit.exitCode, signal: exit.signal, reason: exit.reason }
      append({ kind: 'end', ...exitInfo, status: failure ? 'incomplete' : 'complete' })
      closed = true
      try {
        fs.closeSync(descriptor)
      }
      catch (error) {
        retainFailure(error)
      }
    },
    getFailure: () => failure,
  }
}
