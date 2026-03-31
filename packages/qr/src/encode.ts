/**
 * @file 二维码矩阵编码封装。
 */
import type { QRCodeMatrix } from './types'
import QRErrorCorrectLevel from './vendor/terminal/encoder/errorCorrectLevel'
import QRCode from './vendor/terminal/encoder/qrCode'

interface QRCodeEncoderInstance {
  modules: QRCodeMatrix
  addData: (input: string) => void
  make: () => void
}

type QRCodeEncoderConstructor = new (typeNumber: number, errorCorrectLevel: number) => QRCodeEncoderInstance

const LOW_ERROR_CORRECTION_LEVEL = (QRErrorCorrectLevel as Record<string, number>).L

/** createQrCodeMatrix 的方法封装。 */
export function createQrCodeMatrix(input: string): QRCodeMatrix {
  const QRCodeCtor = QRCode as unknown as QRCodeEncoderConstructor
  const qrcode = new QRCodeCtor(-1, LOW_ERROR_CORRECTION_LEVEL)
  qrcode.addData(input)
  qrcode.make()
  return qrcode.modules
}
