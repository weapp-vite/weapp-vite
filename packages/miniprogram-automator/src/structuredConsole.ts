export interface ConsoleLogOptions {
  /** 使用 CDP 原始参数，并读取 Error 的非枚举数据属性；默认保留 SDK 日志格式。 */
  structured?: boolean
}

export interface ConsoleRemoteObject {
  type?: string
  subtype?: string
  className?: string
  objectId?: string
  description?: string
  value?: unknown
  /** 属性查询失败时保留原参数和诊断，不把不可检查的错误当作成功。 */
  inspectionError?: string
  [key: string]: unknown
}

export interface StructuredConsoleEntry {
  type: string
  args: ConsoleRemoteObject[]
  [key: string]: unknown
}

interface PendingEntry {
  original: StructuredConsoleEntry
  result?: StructuredConsoleEntry
  task: Promise<void>
}

type Send = (method: string, params: Record<string, unknown>, options: { timeout: number }) => Promise<unknown>

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function isRemoteError(arg: ConsoleRemoteObject) {
  return isRecord(arg) && arg.type === 'object' && typeof arg.objectId === 'string'
    && (arg.subtype === 'error' || /^(?:Error|EvalError|RangeError|ReferenceError|SyntaxError|TypeError|URIError|AggregateError)$/.test(arg.className ?? ''))
}

/** 按原始事件顺序发布日志；查询仅读取 Error 数据描述符，不执行 getter 或远程函数。 */
export class StructuredConsole {
  enabled = false
  private pending: PendingEntry[] = []

  constructor(private send: Send, private emit: (entry: StructuredConsoleEntry) => void) {}

  receive = (event: unknown) => {
    if (!this.enabled || !isRecord(event) || event.domain !== 'Runtime' || event.event !== 'consoleAPICalled') {
      return
    }
    const params = event.params
    if (!isRecord(params) || typeof params.type !== 'string' || !Array.isArray(params.args)) {
      return
    }
    const original = params as StructuredConsoleEntry
    const entry: PendingEntry = { original, task: Promise.resolve() }
    this.pending.push(entry)
    entry.task = Promise.all(original.args.map(arg => this.inspect(arg))).then((args) => {
      if (!entry.result) {
        entry.result = { ...original, args }
        this.drain()
      }
    })
  }

  async flush() {
    await Promise.all(this.pending.map(entry => entry.task))
  }

  stop() {
    this.enabled = false
    for (const entry of this.pending) {
      entry.result ??= {
        ...entry.original,
        args: entry.original.args.map(arg => isRemoteError(arg)
          ? { ...arg, inspectionError: 'Console connection closed before Error inspection completed' }
          : arg),
      }
    }
    this.drain()
  }

  private drain() {
    while (this.pending[0]?.result) {
      const entry = this.pending.shift()!
      this.emit(entry.result!)
    }
  }

  private async inspect(arg: ConsoleRemoteObject): Promise<ConsoleRemoteObject> {
    if (!isRemoteError(arg)) {
      return arg
    }
    try {
      const response = await this.send('App.CDPCommand', {
        domain: 'Runtime',
        method: 'getProperties',
        params: { objectId: arg.objectId, ownProperties: true, accessorPropertiesOnly: false, generatePreview: false },
      }, { timeout: 1_000 })
      if (!isRecord(response) || !Array.isArray(response.result) || response.exceptionDetails) {
        throw new Error('Runtime.getProperties did not return Error data descriptors')
      }
      const value: Record<string, string> = { name: arg.className ?? 'Error' }
      for (const descriptor of response.result) {
        if (!isRecord(descriptor) || !['name', 'message', 'stack'].includes(String(descriptor.name))) {
          continue
        }
        if (!('get' in descriptor) && !('set' in descriptor) && isRecord(descriptor.value) && typeof descriptor.value.value === 'string') {
          value[String(descriptor.name)] = descriptor.value.value
        }
      }
      return {
        ...arg,
        value,
        ...(!('message' in value) && !('stack' in value)
          ? { inspectionError: 'Error has no readable message or stack data descriptors' }
          : {}),
      }
    }
    catch (error) {
      return { ...arg, inspectionError: error instanceof Error ? error.message : String(error) }
    }
  }
}
