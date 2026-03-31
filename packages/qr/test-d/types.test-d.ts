import type { QRCodeMatrix, QRCodeRenderOptions } from '@weapp-vite/qr'
import { expectAssignable, expectError, expectType } from 'tsd'

expectAssignable<QRCodeMatrix>([[true, false], [false, true]])
expectAssignable<QRCodeRenderOptions>({})
expectAssignable<QRCodeRenderOptions>({ small: false })

declare const matrix: QRCodeMatrix
declare const options: QRCodeRenderOptions

expectType<boolean[]>(matrix[0])
expectType<boolean>(matrix[0][0])
expectType<boolean | undefined>(options.small)

expectError<QRCodeMatrix>([[1, 0]])
expectError<QRCodeRenderOptions>({ small: 1 })
