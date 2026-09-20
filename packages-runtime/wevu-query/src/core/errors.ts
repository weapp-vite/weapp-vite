/** 查询被客户端显式撤销时返回的错误。 */
export class QueryCancelledError extends Error {
  constructor(message = '查询已取消') {
    super(message)
    this.name = 'QueryCancelledError'
  }
}

/** 判断错误是否来自查询客户端的取消流程。 */
export function isQueryCancelled(error: unknown): error is QueryCancelledError {
  return error instanceof QueryCancelledError
}
