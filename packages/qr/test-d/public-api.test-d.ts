import type { QRCodeMatrix, QRCodeRenderOptions } from '@weapp-vite/qr'
import type * as qr from '@weapp-vite/qr'
import { createQrCodeMatrix, decodeQrCodeFromBase64, renderTerminalQrCode } from '@weapp-vite/qr'
import { expectError, expectType } from 'tsd'

type PublicApiName
  = | 'createQrCodeMatrix'
    | 'decodeQrCodeFromBase64'
    | 'renderTerminalQrCode'

type MissingPublicApi = Exclude<PublicApiName, keyof typeof qr>

expectType<never>({} as MissingPublicApi)

expectType<Promise<string>>(decodeQrCodeFromBase64('Zm9v'))

const matrix = createQrCodeMatrix('hello qr')
expectType<QRCodeMatrix>(matrix)
expectType<boolean>(matrix[0][0])

const compact = renderTerminalQrCode('hello qr', { small: true })
expectType<string>(compact)

const full = renderTerminalQrCode('hello qr')
expectType<string>(full)

const renderOptions = { small: true } satisfies QRCodeRenderOptions
expectType<QRCodeRenderOptions>(renderOptions)

expectError(createQrCodeMatrix(123))
expectError(decodeQrCodeFromBase64(123))
expectError(renderTerminalQrCode('hello qr', { small: 'yes' }))
