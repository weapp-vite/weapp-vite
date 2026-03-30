/**
 * @file 终端二维码渲染封装。
 */
import type { QRCodeRenderOptions } from './qrcodeTypes'
import QRCode from './qrcode-terminal/QRCode/index'
import QRErrorCorrectLevel from './qrcode-terminal/QRCode/QRErrorCorrectLevel'

interface QRCodeInstance {
  modules: boolean[][]
  addData: (input: string) => void
  make: () => void
  getModuleCount: () => number
}
type QRCodeConstructor = new (typeNumber: number, errorCorrectLevel: number) => QRCodeInstance
const WHITE_ALL = '\u2588'
const WHITE_BLACK = '\u2580'
const BLACK_WHITE = '\u2584'
const BLACK_ALL = ' '
const errorLevel = (QRErrorCorrectLevel as Record<string, number>).L
function fill<T>(length: number, value: T) {
  return Array.from({ length }).fill(value) as T[]
}
/** renderTerminalQrCode 的方法封装。 */
export function renderTerminalQrCode(input: string, options: QRCodeRenderOptions = {}) {
  const QRCodeCtor = QRCode as unknown as QRCodeConstructor
  const qrcode = new QRCodeCtor(-1, errorLevel)
  qrcode.addData(input)
  qrcode.make()
  if (!options.small) {
    const black = '\u001B[40m  \u001B[0m'
    const white = '\u001B[47m  \u001B[0m'
    const border = Array.from({ length: qrcode.getModuleCount() + 2 }).fill(white).join('')
    let output = `${border}\n`
    qrcode.modules.forEach((row: boolean[]) => {
      output += white
      output += row.map(cell => cell ? black : white).join('')
      output += `${white}\n`
    })
    output += border
    return output
  }
  const moduleCount = qrcode.getModuleCount()
  const moduleData = [...qrcode.modules] as boolean[][]
  const oddRow = moduleCount % 2 === 1
  if (oddRow) {
    moduleData.push(fill<boolean>(moduleCount, false))
  }
  const borderTop = Array.from({ length: moduleCount + 2 }).fill(BLACK_WHITE).join('')
  const borderBottom = Array.from({ length: moduleCount + 2 }).fill(WHITE_BLACK).join('')
  let output = `${borderTop}\n`
  for (let row = 0; row < moduleCount; row += 2) {
    output += WHITE_ALL
    for (let col = 0; col < moduleCount; col += 1) {
      const top = moduleData[row][col]
      const bottom = moduleData[row + 1][col]
      if (!top && !bottom) {
        output += WHITE_ALL
      }
      else if (!top && bottom) {
        output += WHITE_BLACK
      }
      else if (top && !bottom) {
        output += BLACK_WHITE
      }
      else {
        output += BLACK_ALL
      }
    }
    output += `${WHITE_ALL}\n`
  }
  if (!oddRow) {
    output += borderBottom
  }
  return output
}
