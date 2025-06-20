import { injectable } from 'inversify'

@injectable()
export class UserContext {
  public userId: string
  constructor() {
    this.userId = `user-${Math.floor(Math.random() * 10000)}`
    console.log('>> inRequestScope Created UserContext:', this.userId)
  }
}
