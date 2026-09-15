import type { HeadlessWxRequestOption, HeadlessWxRequestSuccessResult } from '../../host'
import type { RuntimeScheduler } from '../../kernel'
import type { HeadlessWxRequestMockDefinition } from '../wxState'
import { createRequestTask } from './task'
/** 仅模拟已声明的分块；不进行网络访问，也不把完整 response 拆成假分块。 */
export function createChunkedMockRequest(
  option: HeadlessWxRequestOption,
  mock: HeadlessWxRequestMockDefinition,
  response: HeadlessWxRequestSuccessResult,
  scheduler: Pick<RuntimeScheduler, 'setTimeout' | 'clearTimeout'>,
  onSuccess: () => void,
) {
  let timer: ReturnType<RuntimeScheduler['setTimeout']>
  const request = createRequestTask(option, () => scheduler.clearTimeout(timer))
  const chunks = (mock.chunks ?? []).map(chunk => ({ ...chunk, data: chunk.data.slice(0) }))
  let index = 0
  function next() {
    if (request.settled) {
      return
    }
    const chunk = chunks[index++]
    if (chunk) {
      timer = scheduler.setTimeout(() => {
        request.chunk(chunk.data)
        next()
      }, Math.max(0, chunk.delay ?? 0))
    }
    else {
      timer = scheduler.setTimeout(() => {
        if (request.settled) {
          return
        }
        if (mock.error) {
          request.fail(new Error(mock.error))
        }
        else {
          onSuccess()
          request.succeed({ ...response, data: '' })
        }
      }, 0)
    }
  }
  timer = scheduler.setTimeout(() => {
    request.headers({ cookies: response.cookies, header: response.header, statusCode: response.statusCode })
    next()
  }, Math.max(0, mock.delay ?? 0))
  return request.task
}
