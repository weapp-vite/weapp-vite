import { expectType } from 'tsd'
import { createMiniProgramHostConfig } from '../src/project'

const config = createMiniProgramHostConfig({ pages: ['pages/index/index'] })

expectType<Record<string, any>>(config)
