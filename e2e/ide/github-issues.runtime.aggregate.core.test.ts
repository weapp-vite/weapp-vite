import { afterAll } from 'vitest'
import { closeSharedMiniProgram } from './github-issues.runtime.shared'
import './github-issues.runtime.issue1008.test'
import './github-issues.runtime.app-shell.test'
import './github-issues.runtime.issue289.test'
import './github-issues.runtime.issue297-302.test'
import './github-issues.runtime.issue553-555.test'
import './github-issues.runtime.issue554.test'
import './github-issues.runtime.issue564.test'
import './github-issues.runtime.issue581.test'
import './github-issues.runtime.issue627.test'

afterAll(async () => {
  await closeSharedMiniProgram({ force: true })
})
