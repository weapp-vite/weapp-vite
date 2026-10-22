import type { Connection } from '@weapp-vite/miniprogram-automator'
import { expectError, expectType } from 'tsd'

declare const connection: Connection
expectType<boolean>(connection.prefersAppServicePageProtocol)
expectType<boolean>(connection.prefersAppServicePageMethod)
expectType<boolean>(connection.prefersComponentCallerBridge)
expectError(connection.prefersAppServicePageMethod = true)
expectError(connection.prefersComponentCallerBridge = true)
expectType<void>(connection.configureToolInfo({ version: '2.02.2609231' }))
expectType<void>(connection.configureToolInfo({ version: '2.02.2608080', SDKVersion: '3.17.5' }))
