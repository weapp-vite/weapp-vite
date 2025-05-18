import { injectable } from 'inversify'

@injectable()
export class TokenGenerator {
  private token: string
  constructor() {
    this.token = `token-${Math.random().toString(36).substring(7)}`
    console.log('>> Created TokenGenerator:', this.token)
  }

  getToken() {
    return this.token
  }
}
