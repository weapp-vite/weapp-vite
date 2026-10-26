import { describe, expect, it } from 'vitest'
import { resetRuntimeStateForFreshBuild } from './resetRuntimeState'
import { createRuntimeState } from './runtimeState'

describe('public build queue', () => {
  it('starts queued work explicitly and preserves EventTarget listeners across build resets', async () => {
    const state = createRuntimeState()
    const queue = state.build.queue
    const completed: unknown[] = []
    const listener = (event: CustomEvent<unknown>) => completed.push(event.detail)
    queue.addEventListener('completed', listener)
    const run: string[] = []
    const first = queue.add(async () => {
      run.push('first')
      return 'first-result'
    })
    const second = queue.add(async () => {
      run.push('second')
      return 'second-result'
    })

    expect(run).toEqual([])
    expect(queue.size).toBe(2)
    resetRuntimeStateForFreshBuild(state)
    expect(state.build.queue).toBe(queue)

    queue.start()
    await expect(Promise.all([first, second])).resolves.toEqual(['first-result', 'second-result'])
    await queue.onIdle()
    expect(run).toEqual(['first', 'second'])
    expect(completed).toEqual(['first-result', 'second-result'])
    queue.removeEventListener('completed', listener)
    await queue.add(async () => 'third-result')
    expect(completed).toHaveLength(2)
  })

  it('rejects pending work when cleared and remains usable for the next build', async () => {
    const queue = createRuntimeState().build.queue
    let executed = false
    const pending = queue.add(async () => {
      executed = true
    })
    const rejection = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    queue.clear()
    await rejection
    expect(executed).toBe(false)
    expect(queue.size).toBe(0)

    queue.start()
    await expect(queue.add(async () => 'next-build')).resolves.toBe('next-build')
    await queue.onIdle()
  })
})
