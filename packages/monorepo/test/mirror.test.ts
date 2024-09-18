import { setMirror } from '@/mirror'

describe('mirror', () => {
  it('setMirror', () => {
    const settingsJson = {}
    setMirror(settingsJson)
    expect(settingsJson).toMatchSnapshot()
  })
})
