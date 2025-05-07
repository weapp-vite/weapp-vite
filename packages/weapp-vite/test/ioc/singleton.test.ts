import { container, Samurai } from './singleton'

describe('singleton', () => {
  it('should ', () => {
    const samurai0: Samurai = container.get(Samurai)
    const samurai1: Samurai = container.get(Samurai)
    expect(samurai0.katana).toBe(samurai1.katana)
  })
})
