import { afterAll } from 'vitest'
import { closeSharedMiniProgram } from './github-issues.runtime.shared'
import './github-issues.runtime.web-runtime.test'
import './github-issues.runtime.import-meta.test'
import './github-issues.runtime.issue466.test'
import './github-issues.runtime.issue642.test'
import './github-issues.runtime.issue705.test'
import './github-issues.runtime.issue706.test'
import './github-issues.runtime.issue829.test'
import './github-issues.runtime.issue930.test'
import './github-issues.runtime.issue1013.test'

afterAll(async () => {
  await closeSharedMiniProgram({ force: true })
})
