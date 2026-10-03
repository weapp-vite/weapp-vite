import type { IConnectOptions, ILaunchOptions, OperationDiagnostics, OperationErrorCategory } from '@weapp-vite/miniprogram-automator'
import { classifyOperationError, Connection, OperationLifecycle, readWechatLoginState } from '@weapp-vite/miniprogram-automator'
import { OperationLifecycle as LightweightOperationLifecycle, readWechatLoginState as readLightweightLoginState } from '@weapp-vite/miniprogram-automator/operation'
import { expectType } from 'tsd'

const controller = new AbortController()
const connect: IConnectOptions = { wsEndpoint: 'ws://localhost', signal: controller.signal, timeout: 100 }
const launch: ILaunchOptions = { signal: controller.signal, timeout: 100 }
expectType<AbortSignal | undefined>(connect.signal)
expectType<AbortSignal | undefined>(launch.signal)
expectType<Promise<Connection>>(Connection.create(connect.wsEndpoint, connect.timeout, connect.signal))
const operation = new OperationLifecycle(100, 'test', controller.signal)
expectType<OperationDiagnostics>(operation.diagnostics)
expectType<Promise<number>>(operation.run(async scope => await scope.step(async () => 1, { stage: 'version' })))
expectType<OperationErrorCategory>(classifyOperationError(new Error('error')))
expectType<boolean | undefined>(readWechatLoginState('{"login":false}'))
expectType<OperationLifecycle>(new LightweightOperationLifecycle(100, 'test'))
expectType<typeof readWechatLoginState>(readLightweightLoginState)
