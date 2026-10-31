import type WebSocket from 'ws'
import { Connection, Transport } from '@weapp-vite/miniprogram-automator'
import { expectError, expectType } from 'tsd'

declare const socket: WebSocket
const transport = new Transport(socket)
expectType<Transport>(transport)
expectType<void>(transport.send('{"id":1,"method":"App.getCurrentPages"}'))
expectType<Promise<void>>(transport.close())
expectType<Connection>(new Connection(transport))
expectError(new Transport({ readyState: 1 }))
