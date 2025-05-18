import type { Weapon } from './simple0'
import { Container, inject } from 'inversify'
import { Katana } from './simple'

export class LegendaryWarrior {
  constructor(
    @inject('Weapon') public readonly firstWeapon: Weapon,
    @inject('Weapon') public readonly secondWeapon: Weapon,
    @inject('Weapon') public readonly thirdWeapon: Weapon,
  ) {}
}

const container: Container = new Container()
container.bind<Weapon>('Weapon').to(Katana).inRequestScope()
container.bind(LegendaryWarrior).toSelf()// .inSingletonScope()

const firstKatana: Weapon = container.get<Weapon>('Weapon')
const secondKatana: Weapon = container.get<Weapon>('Weapon')

const legendaryWarrior: LegendaryWarrior = container.get(LegendaryWarrior)

describe('requiest scope', () => {
  it('katana', () => {
  // Returns false
    const isSameKatana: boolean = firstKatana === secondKatana
    expect(isSameKatana).toBe(false)
    // Returns true
    const warriorHasSameKatana: boolean
  = legendaryWarrior.firstWeapon === legendaryWarrior.secondWeapon
    && legendaryWarrior.secondWeapon === legendaryWarrior.thirdWeapon
    expect(warriorHasSameKatana).toBe(true)
  })
})
