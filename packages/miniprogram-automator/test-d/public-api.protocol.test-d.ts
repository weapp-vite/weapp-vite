import type { Connection } from '..'
import { expectError, expectType } from 'tsd'

declare const connection: Connection
expectType<boolean>(connection.prefersAppServicePageProtocol)
expectType<boolean>(connection.prefersAppServicePageMethod)
expectError(connection.prefersAppServicePageMethod = true)
expectType<void>(connection.configureToolInfo({ version: '2.02.2609231' }))
