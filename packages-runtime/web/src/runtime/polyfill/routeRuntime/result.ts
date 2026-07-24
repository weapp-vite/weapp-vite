import type { MiniProgramAsyncOptions, MiniProgramBaseResult } from '../types'
import {
  callMiniProgramAsyncFailure,
  callMiniProgramAsyncSuccess,
} from '../async'

export function resolveRouteAction(
  action: string,
  options: MiniProgramAsyncOptions<MiniProgramBaseResult> | undefined,
  succeeded: boolean,
) {
  if (succeeded) {
    return Promise.resolve(callMiniProgramAsyncSuccess(options, {
      errMsg: `${action}:ok`,
    }))
  }
  const failure = callMiniProgramAsyncFailure(options, `${action}:fail page not found`)
  return Promise.reject(failure)
}
