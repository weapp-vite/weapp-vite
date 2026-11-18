import { afterAll } from 'vitest'
import { closeSharedMiniProgram } from './github-issues.runtime.shared'
import './github-issues.runtime.miniprogram-computed.test'
import './github-issues.runtime.props.test'
import './github-issues.runtime.slot-fallback.test'

afterAll(async () => {
  await closeSharedMiniProgram({ force: true })
})
