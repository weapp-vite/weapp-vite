/**
 * @file 终端二维码渲染封装。
 */
import type { QRCodeMatrix, QRCodeRenderOptions } from './types'
import { createQrCodeMatrix } from './encode'

const WHITE_ALL = '\u2588'
const WHITE_BLACK = '\u2580'
const BLACK_WHITE = '\u2584'
const BLACK_ALL = ' '

function fill<T>(length: number, value: T) {
  return Array.from({ length }).fill(value) as T[]
}

function renderCompactQrCode(matrix: QRCodeMatrix) {
  const moduleCount = matrix.length
  const moduleData = [...matrix]
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

function renderFullQrCode(matrix: QRCodeMatrix) {
  const black = '\u001B[40m  \u001B[0m'
  const white = '\u001B[47m  \u001B[0m'
  const border = Array.from({ length: matrix.length + 2 }).fill(white).join('')
  let output = `${border}\n`

  matrix.forEach((row) => {
    output += white
    output += row.map(cell => cell ? black : white).join('')
    output += `${white}\n`
  })

  output += border
  return output
}

/** renderTerminalQrCode 的方法封装。 */
export function renderTerminalQrCode(input: string, options: QRCodeRenderOptions = {}) {
  const matrix = createQrCodeMatrix(input)
  return options.small ? renderCompactQrCode(matrix) : renderFullQrCode(matrix)
}
