import type { Logger } from './Logger'
import type { TokenGenerator } from './TokenGenerator'
import type { UserContext } from './UserContext'
import { inject, injectable } from 'inversify'
import { TYPES } from './types'

@injectable()
export class ServiceA {
  constructor(
    @inject(TYPES.UserContext) public ctx: UserContext,
    @inject(TYPES.TokenGenerator) public tokenGen: TokenGenerator,
    @inject(TYPES.Logger) public logger: Logger,
  ) {
    console.log('>> Created ServiceA')
  }

  print(label: string) {
    console.log(`[${label}] Context ID: ${this.ctx.userId}`)
    console.log(`[${label}] Token: ${this.tokenGen.getToken()}`)
  }
}
