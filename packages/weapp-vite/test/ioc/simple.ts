import { Container, inject, injectable } from 'inversify'

@injectable()
export class Katana {
  public readonly damage: number = 10
}

@injectable()
export class Ninja {
  constructor(
    @inject(Katana)
    public readonly katana: Katana,
  ) {}
}

const container: Container = new Container()

container.bind(Ninja).toSelf()
container.bind(Katana).toSelf()

export {
  container,
}
