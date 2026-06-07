import type { Suite } from 'vitest'
import process from 'node:process'
import { beforeAll, beforeEach } from 'vitest'
import { getDevtoolsSkipReason, markSuiteSkipped } from './utils/devtoolsSkip'

beforeAll(function () {
  const skipReason = getDevtoolsSkipReason()
  // Vitest suite hook 的 suite 在运行时第二参数里；显式声明参数会触发 fixture 解析。
  // eslint-disable-next-line prefer-rest-params
  const suite = arguments[1] as Suite | undefined
  if (skipReason && suite) {
    markSuiteSkipped(suite)
  }
})

beforeEach((context) => {
  const skipReason = getDevtoolsSkipReason(process.env)
  if (skipReason) {
    context.skip(skipReason)
  }
})
