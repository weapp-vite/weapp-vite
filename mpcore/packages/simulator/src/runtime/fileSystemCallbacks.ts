import type { HeadlessWxFileSystemCallbackOption } from '../host/wx/fileSystem'

/** 文件系统失败保留 Error 兼容性，并向 fail/complete 提供微信 errMsg 契约。 */
export function runFileSystemOperation<TResult>(operation: () => TResult, option: HeadlessWxFileSystemCallbackOption<TResult>) {
  let result: TResult
  try {
    result = operation()
  }
  catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause))
    const failure = Object.assign(error, { errMsg: error.message })
    option.fail?.(failure)
    option.complete?.(failure)
    return undefined
  }
  option.success?.(result)
  option.complete?.(result)
  return result
}
