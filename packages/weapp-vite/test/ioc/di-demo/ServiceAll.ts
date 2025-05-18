import type { ServiceA } from './ServiceA'
import type { ServiceB } from './ServiceB'
import { inject, injectable } from 'inversify'
import { TYPES } from './types'

@injectable()
export class ServiceAll {
  constructor(
    @inject(TYPES.ServiceA) readonly serviceA: ServiceA,
    @inject(TYPES.ServiceB) readonly serviceB: ServiceB,
  ) {}
}
