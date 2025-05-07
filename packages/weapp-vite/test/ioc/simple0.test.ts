import { container, Ninja } from './simple0'

describe('ioc', () => {
  it('should ', () => {
    const ninja: Ninja = container.get(Ninja)
    const ninja2: Ninja = container.get(Ninja)

    expect(ninja.weapon.damage).toBe(10)
    expect(ninja === ninja2).toBe(false)
  })
})
