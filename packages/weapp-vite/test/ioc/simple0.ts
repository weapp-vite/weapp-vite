import { Container, inject, injectable } from 'inversify'

export interface Weapon {
  damage: number
}

export const weaponServiceId: symbol = Symbol.for('WeaponServiceId')

@injectable()
export class Katana {
  public readonly damage: number = 10
}

@injectable()
export class Ninja {
  constructor(
    @inject(weaponServiceId)
    public readonly weapon: Weapon,
  ) {}
}

export const container: Container = new Container()

container.bind(Ninja).toSelf()
container.bind(weaponServiceId).to(Katana)
