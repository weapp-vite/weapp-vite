/** 仅描述本地执行结果，不代表远端上传已取消。 */
export class UploadExecutionError extends Error {
  /** timeout 为本地超时，interrupted 为本地中断，failed 为工具或传输失败。 */
  readonly reason: 'timeout' | 'interrupted' | 'failed'
  /** not-started 表示尚未允许 SDK 执行；unknown 表示远端结果需要人工核实。 */
  readonly remoteOutcome: 'not-started' | 'unknown'

  constructor(message: string, reason: UploadExecutionError['reason'], remoteOutcome: UploadExecutionError['remoteOutcome']) {
    super(message)
    this.name = 'UploadExecutionError'
    this.reason = reason
    this.remoteOutcome = remoteOutcome
  }
}
