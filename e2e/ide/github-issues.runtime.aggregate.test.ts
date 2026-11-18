import { afterAll } from 'vitest'
import { closeSharedMiniProgram } from './github-issues.runtime.shared'
import './github-issues.runtime.aggregate.core.test'
import './github-issues.runtime.aggregate.runtime.test'
import './github-issues.runtime.aggregate.lifecycle.test'
import './github-issues.runtime.aggregate.components.test'

afterAll(async () => {
  await closeSharedMiniProgram({ force: true })
})
