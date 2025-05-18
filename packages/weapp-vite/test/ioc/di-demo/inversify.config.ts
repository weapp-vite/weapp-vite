import { Container } from 'inversify'
import { Logger } from './Logger'
import { ServiceA } from './ServiceA'
import { TokenGenerator } from './TokenGenerator'
import { TYPES } from './types'
import { UserContext } from './UserContext'

const container = new Container()

container.bind<Logger>(TYPES.Logger).to(Logger).inSingletonScope()
container.bind<UserContext>(TYPES.UserContext).to(UserContext).inRequestScope()
container.bind<TokenGenerator>(TYPES.TokenGenerator).to(TokenGenerator).inTransientScope()
container.bind<ServiceA>(TYPES.ServiceA).to(ServiceA)// .inSingletonScope()// .inRequestScope()

export { container }
