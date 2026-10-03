import { expect, it } from 'vitest'
import { applyAction } from './driver'
import { FrameworkSequenceSession } from './framework'
import { createFrameworkResourceSequence } from './frameworkSequence'
import { createSequenceProject } from './project'

it('publishes the first classic edit through the live host and reloads the real runtime', async () => {
  const project = await createSequenceProject()
  const session = new FrameworkSequenceSession('weapp-classic', project.root)
  const sequence = createFrameworkResourceSequence(14, 2)
  const files = { ...sequence.files }
  try {
    const initial = await session.observe({ files, step: 0, signal: AbortSignal.timeout(30_000) })
    expect(initial.pages['pages/page-0000/index']).toMatchObject({ data: { message: 'page-0000-v0000' } })
    const action = sequence.steps[0]!.action
    applyAction(files, action)
    // 两页回归仅定位首次编辑的事件链；正式资源序列继续使用 worker 的 180 秒预算。
    const updated = await session.observe({ files, step: 1, action, signal: AbortSignal.timeout(15_000) })
    expect(updated.pages['pages/page-0000/index']).toMatchObject({ data: { message: 'page-0000-v0001' } })
    expect(updated.pages['pages/page-0001/index']).toEqual(initial.pages['pages/page-0001/index'])
    expect(session.observeSession().watchers).toBe(1)
  }
  finally {
    try {
      await session.close()
    }
    finally {
      await project.close()
    }
  }
  expect(session.observeSession()).toEqual({ watchers: 0, engines: 0 })
}, 60_000)
