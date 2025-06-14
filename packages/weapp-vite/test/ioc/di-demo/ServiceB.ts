import type { TokenGenerator } from './TokenGenerator'
import type { UserContext } from './UserContext'
import { inject, injectable } from 'inversify'
import { TYPES } from './types'

@injectable()
export class ServiceB {
  constructor(
    @inject(TYPES.UserContext) public ctx: UserContext,
    @inject(TYPES.TokenGenerator) public tokenGen: TokenGenerator,
  ) {
    console.log('>> Created ServiceB')
  }

  print(label: string) {
    console.log(`[${label}] Context ID: ${this.ctx.userId}`)
    console.log(`[${label}] Token: ${this.tokenGen.getToken()}`)
  }
}
