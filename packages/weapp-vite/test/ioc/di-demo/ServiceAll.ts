import type { Logger } from './Logger'
import type { ServiceA } from './ServiceA'
import type { ServiceB } from './ServiceB'
import type { TokenGenerator } from './TokenGenerator'
import { inject, injectable } from 'inversify'
import { TYPES } from './types'

@injectable()
export class ServiceAll {
  constructor(
    @inject(TYPES.ServiceA) readonly serviceA: ServiceA,
    @inject(TYPES.ServiceB) readonly serviceB: ServiceB,
    @inject(TYPES.Logger) readonly logger: Logger,
    @inject(TYPES.TokenGenerator) public tokenGen: TokenGenerator,
  ) {
    console.log('>> Created ServiceAll')
  }
}
