import { afterAll } from 'vitest'
import { closeSharedMiniProgram } from './github-issues.runtime.shared'
import './github-issues.runtime.lifecycle.test'
import './github-issues.runtime.issue1014.test'

afterAll(async () => {
  await closeSharedMiniProgram({ force: true })
})
