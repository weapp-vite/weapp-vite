// @ts-nocheck
import Decoder from '../parse/decoder'
/**
 * @file 二维码解析内部模块：qrcode。
 */
import Detector from '../detect/detector'

export var qrcode = {}
qrcode.sizeOfDataLengthInfo = [[10, 9, 8, 8], [12, 11, 16, 10], [14, 13, 16, 12]]
export default function QrCode() {
  this.imagedata = null
  this.width = 0
  this.height = 0
  this.qrCodeSymbol = null
  this.debug = false
  this.callback = null
}
QrCode.prototype.decode = function (src, data) {
  const decode = function () {
    try {
      this.error = undefined
      this.result = this.process(this.imagedata)
    }
    catch (e) {
      this.error = e
      this.result = undefined
    }
    if (this.callback != null) {
      this.callback(this.error, this.result)
    }
    return this.result
  }.bind(this)
  if (src != undefined && src.width != undefined) {
    this.width = src.width
    this.height = src.height
    this.imagedata = { data: data || src.data }
    this.imagedata.width = src.width
    this.imagedata.height = src.height
    decode()
  }
  else {
    if (typeof Image === 'undefined') {
      throw new TypeError('This source format is not supported in your environment, you need to pass an image buffer with width and height (see https://github.com/edi9999/jsqrcode/blob/master/test/qrcode.js)')
    }
    const image = new Image()
    image.crossOrigin = 'Anonymous'
    image.onload = function () {
      const canvas_qr = document.createElement('canvas')
      const context = canvas_qr.getContext('2d')
      const canvas_out = document.getElementById('out-canvas')
      if (canvas_out != null) {
        const outctx = canvas_out.getContext('2d')
        outctx.clearRect(0, 0, 320, 240)
        outctx.drawImage(image, 0, 0, 320, 240)
      }
      canvas_qr.width = image.width
      canvas_qr.height = image.height
      context.drawImage(image, 0, 0)
      this.width = image.width
      this.height = image.height
      try {
        this.imagedata = context.getImageData(0, 0, image.width, image.height)
      }
      catch (e) {
        this.result = 'Cross domain image reading not supported in your browser! Save it to your computer then drag and drop the file!'
        if (this.callback != null) { return this.callback(null, this.result) }
      }
      decode()
    }.bind(this)
    image.src = src
  }
}
QrCode.prototype.decode_utf8 = function (s) {
  return decodeURIComponent(escape(s))
}
QrCode.prototype.process = function (imageData) {
  const start = Date.now()
  const image = this.grayScaleToBitmap(this.grayscale(imageData))
  const detector = new Detector(image)
  const qRCodeMatrix = detector.detect()
  const reader = Decoder.decode(qRCodeMatrix.bits)
  const data = reader.DataByte
  let str = ''
  for (let i = 0; i < data.length; i++) {
    for (let j = 0; j < data[i].length; j++) { str += String.fromCharCode(data[i][j]) }
  }
  const end = Date.now()
  const time = end - start
  if (this.debug) {
    console.log(`QR Code processing time (ms): ${time}`)
  }
  return { result: this.decode_utf8(str), points: qRCodeMatrix.points }
}
QrCode.prototype.getPixel = function (imageData, x, y) {
  if (imageData.width < x) {
    throw 'point error'
  }
  if (imageData.height < y) {
    throw 'point error'
  }
  const point = (x * 4) + (y * imageData.width * 4)
  return (imageData.data[point] * 33 + imageData.data[point + 1] * 34 + imageData.data[point + 2] * 33) / 100
}
QrCode.prototype.binarize = function (th) {
  const ret = new Array(this.width * this.height)
  for (let y = 0; y < this.height; y++) {
    for (let x = 0; x < this.width; x++) {
      const gray = this.getPixel(x, y)
      ret[x + y * this.width] = gray <= th
    }
  }
  return ret
}
QrCode.prototype.getMiddleBrightnessPerArea = function (imageData) {
  const numSqrtArea = 4
  const areaWidth = Math.floor(imageData.width / numSqrtArea)
  const areaHeight = Math.floor(imageData.height / numSqrtArea)
  const minmax = Array.from({ length: numSqrtArea })
  for (let i = 0; i < numSqrtArea; i++) {
    minmax[i] = Array.from({ length: numSqrtArea })
    for (let i2 = 0; i2 < numSqrtArea; i2++) {
      minmax[i][i2] = [0, 0]
    }
  }
  for (var ay = 0; ay < numSqrtArea; ay++) {
    for (var ax = 0; ax < numSqrtArea; ax++) {
      minmax[ax][ay][0] = 0xFF
      for (let dy = 0; dy < areaHeight; dy++) {
        for (let dx = 0; dx < areaWidth; dx++) {
          const target = imageData.data[areaWidth * ax + dx + (areaHeight * ay + dy) * imageData.width]
          if (target < minmax[ax][ay][0]) { minmax[ax][ay][0] = target }
          if (target > minmax[ax][ay][1]) { minmax[ax][ay][1] = target }
        }
      }
    }
  }
  const middle = Array.from({ length: numSqrtArea })
  for (let i3 = 0; i3 < numSqrtArea; i3++) {
    middle[i3] = Array.from({ length: numSqrtArea })
  }
  for (var ay = 0; ay < numSqrtArea; ay++) {
    for (var ax = 0; ax < numSqrtArea; ax++) {
      middle[ax][ay] = Math.floor((minmax[ax][ay][0] + minmax[ax][ay][1]) / 2)
    }
  }
  return middle
}
QrCode.prototype.grayScaleToBitmap = function (grayScaleImageData) {
  const middle = this.getMiddleBrightnessPerArea(grayScaleImageData)
  const sqrtNumArea = middle.length
  const areaWidth = Math.floor(grayScaleImageData.width / sqrtNumArea)
  const areaHeight = Math.floor(grayScaleImageData.height / sqrtNumArea)
  for (let ay = 0; ay < sqrtNumArea; ay++) {
    for (let ax = 0; ax < sqrtNumArea; ax++) {
      for (let dy = 0; dy < areaHeight; dy++) {
        for (let dx = 0; dx < areaWidth; dx++) {
          grayScaleImageData.data[areaWidth * ax + dx + (areaHeight * ay + dy) * grayScaleImageData.width] = (grayScaleImageData.data[areaWidth * ax + dx + (areaHeight * ay + dy) * grayScaleImageData.width] < middle[ax][ay])
        }
      }
    }
  }
  return grayScaleImageData
}
QrCode.prototype.grayscale = function (imageData) {
  const ret = new Array(imageData.width * imageData.height)
  for (let y = 0; y < imageData.height; y++) {
    for (let x = 0; x < imageData.width; x++) {
      const gray = this.getPixel(imageData, x, y)
      ret[x + y * imageData.width] = gray
    }
  }
  return {
    height: imageData.height,
    width: imageData.width,
    data: ret,
  }
}
export function URShift(number, bits) {
  if (number >= 0) { return number >> bits }
  else { return (number >> bits) + (2 << ~bits) }
}
