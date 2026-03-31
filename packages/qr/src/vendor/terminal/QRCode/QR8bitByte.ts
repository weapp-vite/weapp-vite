// @ts-nocheck
/**
 * @file 终端二维码编码内部模块：QR8bitByte。
 */
import QRMode from './QRMode'

function QR8bitByte(data) {
  this.mode = QRMode.MODE_8BIT_BYTE
  this.data = data
}
QR8bitByte.prototype = {
  getLength() {
    return this.data.length
  },
  write(buffer) {
    for (let i = 0; i < this.data.length; i++) {
      buffer.put(this.data.charCodeAt(i), 8)
    }
  },
}
export default QR8bitByte
