import { afterAll } from 'vitest'
import { closeSharedMiniProgram } from './github-issues.runtime.shared'
import './github-issues.runtime.issue289.test'
import './github-issues.runtime.issue297-302.test'

afterAll(async () => {
  await closeSharedMiniProgram({ force: true })
})
