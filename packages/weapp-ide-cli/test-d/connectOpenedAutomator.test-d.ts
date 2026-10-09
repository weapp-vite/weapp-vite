import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { expectError, expectType } from 'tsd'
import { connectOpenedAutomator } from 'weapp-ide-cli'

expectType<Promise<MiniProgram>>(connectOpenedAutomator({ projectPath: 'fixture' }))
connectOpenedAutomator({ projectPath: 'fixture', port: 19201 }).then((program) => {
  expectType<Promise<void>>(program.close())
  expectType<void>(program.disconnect())
})
expectError(connectOpenedAutomator({ port: 19201 }))
