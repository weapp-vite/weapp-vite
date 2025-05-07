import { Container, inject, injectable } from 'inversify'

@injectable()
export class Katana {
  public readonly damage: number = 10
}

@injectable()
export class Samurai {
  public readonly katana: Katana

  constructor(

    @inject(Katana)
    katana: Katana,
  ) {
    this.katana = katana
  }
}

export const container: Container = new Container()

container.bind(Katana).toSelf().inSingletonScope()
container.bind(Samurai).toSelf().inSingletonScope()
