import { afterAll } from 'vitest'
import { closeSharedMiniProgram } from './github-issues.runtime.shared'
import './github-issues.runtime.issue1008.test'
import './github-issues.runtime.app-shell.test'

afterAll(async () => {
  await closeSharedMiniProgram({ force: true })
})
