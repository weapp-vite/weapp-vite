/**
 * @file 终端二维码编码内部模块：byte。
 */
import QRMode from './mode'

class QR8bitByte {
  mode: number
  data: string

  constructor(data: string) {
    this.mode = QRMode.MODE_8BIT_BYTE
    this.data = data
  }

  getLength() {
    return this.data.length
  }

  write(buffer: { put: (value: number, length: number) => void }) {
    for (let i = 0; i < this.data.length; i++) {
      buffer.put(this.data.charCodeAt(i), 8)
    }
  }
}

export default QR8bitByte
