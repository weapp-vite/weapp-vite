import { container, Ninja } from './simple'

describe('ioc', () => {
  it('should ', () => {
    const ninja: Ninja = container.get(Ninja)
    const ninja2: Ninja = container.get(Ninja)

    expect(ninja.katana.damage).toBe(10)
    expect(ninja === ninja2).toBe(false)
    const ninjas = container.getAll(Ninja)
    expect(ninjas).toBeDefined()
  })
})
