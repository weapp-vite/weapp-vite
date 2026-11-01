import process from 'node:process'
import { expectAssignable, expectType } from 'tsd'
import 'weapp-vite/client'

expectType<RUNTIME_PLATFORM | undefined>(process.env.PLATFORM)
expectType<string | undefined>(process.env.CUSTOM_ENV)
expectAssignable<NodeJS.ProcessEnv>({ CUSTOM_ENV: 'consumer' })
expectType<RUNTIME_PLATFORM>(import.meta.env.PLATFORM)
expectType<boolean>(import.meta.env.IS_WEB)
expectType<boolean>(import.meta.env.IS_MINIPROGRAM)
expectType<HTMLElement | null>(document.getElementById('app'))
