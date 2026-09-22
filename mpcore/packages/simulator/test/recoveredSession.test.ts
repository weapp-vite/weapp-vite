import { expect, it } from 'vitest'
import { createRecoveredSessionFixture } from './helpers/recoveredSession'

it('uses the recovered runtime for page state and later navigation through the original caller', () => {
  const fixture = createRecoveredSessionFixture()
  const session = fixture.session
  try {
    const initial = session.reLaunch('/pages/index/index')
    initial.increment()
    expect(session.renderCurrentPage().wxml).toContain('count:1')
    fixture.recover()
    const recovered = session.reLaunch('/pages/index/index')
    expect(recovered).not.toBe(initial)
    expect(session.renderCurrentPage().wxml).toContain('count:0')
    recovered.increment()
    expect(session.renderCurrentPage().wxml).toContain('count:1')
    session.navigateTo('/pages/result/index')
    expect(session.renderCurrentPage().wxml).toContain('ready:true')
    expect(initial.data.count).toBe(1)
  }
  finally {
    fixture.close()
  }
})
