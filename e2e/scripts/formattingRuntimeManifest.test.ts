import { describe, expect, it } from 'vitest'
import { getIdeExhaustiveTasks, getSuiteTasks } from './e2e-suite-manifest'

describe('template formatting runtime coverage', () => {
  const label = 'ide/template-formatting.runtime.test.ts'

  it.each(['ide-full:templates', 'ide-dom-headless', 'ide-headless-full'])(
    'registers the provider-compatible formatting comparison in %s',
    async (suite) => {
      expect((await getSuiteTasks(suite)).filter(task => task.label === label)).toHaveLength(1)
    },
  )

  it('retains the formatting comparison in exhaustive DevTools coverage', () => {
    expect(getIdeExhaustiveTasks().filter(task => task.label === label)).toHaveLength(1)
  })
})
