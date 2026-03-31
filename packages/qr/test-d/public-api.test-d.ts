import type {
  MiniProgramCodeDetectionResult,
  QRCodeMatrix,
  QRCodeReaderInput,
  QRCodeReaderResult,
  QRCodeRenderOptions,
} from '@weapp-vite/qr'
import type * as qr from '@weapp-vite/qr'
import { Buffer } from 'node:buffer'
import {
  createQrCodeMatrix,
  decodeQrCodeFromBase64,
  decodeQrCodeFromBuffer,
  decodeQrCodeFromFile,
  decodeWithQrReader,
  detectMiniProgramCodeFromBase64,
  detectMiniProgramCodeFromBuffer,
  detectMiniProgramCodeFromFile,
  renderTerminalQrCode,
  renderTerminalQrCodeFromMatrix,
} from '@weapp-vite/qr'
import { expectError, expectType } from 'tsd'

type PublicApiName
  = | 'createQrCodeMatrix'
    | 'decodeQrCodeFromBase64'
    | 'decodeQrCodeFromBuffer'
    | 'decodeQrCodeFromFile'
    | 'decodeWithQrReader'
    | 'detectMiniProgramCodeFromBase64'
    | 'detectMiniProgramCodeFromBuffer'
    | 'detectMiniProgramCodeFromFile'
    | 'renderTerminalQrCode'
    | 'renderTerminalQrCodeFromMatrix'

type MissingPublicApi = Exclude<PublicApiName, keyof typeof qr>

expectType<never>({} as MissingPublicApi)

expectType<Promise<string>>(decodeQrCodeFromBase64('Zm9v'))
expectType<Promise<string>>(decodeQrCodeFromBuffer(Buffer.from('Zm9v')))
expectType<Promise<string>>(decodeQrCodeFromFile('/tmp/example.png'))
expectType<Promise<MiniProgramCodeDetectionResult | null>>(detectMiniProgramCodeFromBase64('Zm9v'))
expectType<Promise<MiniProgramCodeDetectionResult | null>>(detectMiniProgramCodeFromBuffer(Buffer.from('Zm9v')))
expectType<Promise<MiniProgramCodeDetectionResult | null>>(detectMiniProgramCodeFromFile('/tmp/example.png'))

const matrix = createQrCodeMatrix('hello qr')
expectType<QRCodeMatrix>(matrix)
expectType<boolean>(matrix[0][0])

const compact = renderTerminalQrCode('hello qr', { small: true })
expectType<string>(compact)

const full = renderTerminalQrCode('hello qr')
expectType<string>(full)
expectType<string>(renderTerminalQrCodeFromMatrix(matrix, { small: false }))

const renderOptions = { small: true } satisfies QRCodeRenderOptions
expectType<QRCodeRenderOptions>(renderOptions)

const readerInput = {
  width: 1,
  height: 1,
  data: Buffer.from([0, 0, 0, 255]),
} satisfies QRCodeReaderInput
expectType<QRCodeReaderInput>(readerInput)
expectType<Promise<QRCodeReaderResult>>(decodeWithQrReader(readerInput))

expectError(createQrCodeMatrix(123))
expectError(decodeQrCodeFromBase64(123))
expectError(decodeQrCodeFromBuffer('Zm9v'))
expectError(decodeQrCodeFromFile(Buffer.from('foo')))
expectError(decodeWithQrReader({ width: 1, height: 1, data: new Uint8Array([0]) }))
expectError(detectMiniProgramCodeFromBase64(123))
expectError(detectMiniProgramCodeFromBuffer('Zm9v'))
expectError(detectMiniProgramCodeFromFile(Buffer.from('foo')))
expectError(renderTerminalQrCode('hello qr', { small: 'yes' }))
