import type { CompilerHmrHost, CompilerInputCaptureObservation } from '../../plugins/compilerPlugin/hmr'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import path from 'pathe'
import { compilerSourceId } from '../../plugins/compilerPlugin/hmr'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

interface InputTraceOptions {
  root: () => string
  enabled?: string
  emit?: (line: string) => void
}

class StatefulHmrInputTrace {
  private readonly sessionId = randomUUID()
  private sequence = 0
  private readonly emit: NonNullable<InputTraceOptions['emit']>

  constructor(private readonly options: InputTraceOptions) {
    this.emit = options.emit ?? (line => process.stdout.write(`${line}\n`))
  }

  private label(file: string) {
    const relative = path.relative(normalizeFsResolvedId(this.options.root()), normalizeFsResolvedId(file))
    return relative === '..' || relative.startsWith('../') || path.isAbsolute(relative) ? '<external>' : relative || '.'
  }

  private record(stage: string, values: Record<string, unknown>) {
    try {
      this.emit(`[stateful-hmr-input] ${JSON.stringify({ sessionId: this.sessionId, sequence: ++this.sequence, stage, ...values })}`)
    }
    catch {
      // 日志接收方失败不得改变输入读取或交付结果。
    }
  }

  observe(host: CompilerHmrHost) {
    return host.observeInputCaptures((observation: CompilerInputCaptureObservation) => {
      this.record('capture', { ...observation })
    })
  }

  input(stage: string, file: string, host: CompilerHmrHost, values: Record<string, string | boolean | undefined> = {}) {
    try {
      this.record(stage, {
        file: this.label(file),
        canonicalFile: this.label(compilerSourceId(file)),
        queried: file.includes('?'),
        input: host.inspectInput(file),
        ...values,
      })
    }
    catch {
      // 身份采样失败也不能改变真实 watchChange 或 sidecar load。
    }
  }
}

/** 默认无订阅、无摘要计算；可与现有快照 trace 同步启用。 */
export function createStatefulHmrInputTrace(options: InputTraceOptions) {
  return (options.enabled ?? process.env.WEAPP_VITE_STATEFUL_HMR_INPUT_TRACE ?? process.env.WEAPP_VITE_STATEFUL_HMR_SNAPSHOT_TRACE) === '1'
    ? new StatefulHmrInputTrace(options)
    : undefined
}
