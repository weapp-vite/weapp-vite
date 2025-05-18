import type { TokenGenerator } from './TokenGenerator'
import type { UserContext } from './UserContext'
import { inject, injectable } from 'inversify'
import { TYPES } from './types'

@injectable()
export class ServiceA {
  constructor(
    @inject(TYPES.UserContext) private ctx: UserContext,
    @inject(TYPES.TokenGenerator) private tokenGen: TokenGenerator,
  ) {}

  print(label: string) {
    console.log(`[${label}] Context ID: ${this.ctx.userId}`)
    console.log(`[${label}] Token: ${this.tokenGen.getToken()}`)
  }
}
