import Detector from '../detect/detector'
/* eslint-disable e18e/prefer-array-fill */
/* eslint-disable no-console */
/**
 * @file 二维码解析内部模块：qrcode。
 */
import Decoder from '../parse/decoder'

interface RgbaImageData {
  width: number
  height: number
  data: ArrayLike<number>
}

interface GrayScaleImageData {
  width: number
  height: number
  data: number[]
}

interface BinaryImageData {
  width: number
  height: number
  data: boolean[]
}

interface BrowserCanvasContext {
  clearRect: (x: number, y: number, width: number, height: number) => void
  drawImage: (image: BrowserImage, x: number, y: number, width?: number, height?: number) => void
  getImageData: (x: number, y: number, width: number, height: number) => RgbaImageData
}

interface BrowserCanvasElement {
  width: number
  height: number
  getContext: (type: '2d') => BrowserCanvasContext | null
}

interface BrowserDocument {
  createElement: (tagName: 'canvas') => BrowserCanvasElement
  getElementById: (id: string) => BrowserCanvasElement | null
}

interface BrowserImage {
  width: number
  height: number
  crossOrigin: string
  onload: (() => void) | null
  src: string
}

type BrowserImageConstructor = new () => BrowserImage

type DecodeSource = RgbaImageData | string

export const qrcode = {
  sizeOfDataLengthInfo: [
    [10, 9, 8, 8],
    [12, 11, 16, 10],
    [14, 13, 16, 12],
  ],
} as const

export default class QrCode {
  imagedata: RgbaImageData | null
  width: number
  height: number
  qrCodeSymbol: unknown
  debug: boolean
  error: Error | undefined
  result: { result: string, points: unknown[] } | undefined

  constructor() {
    this.imagedata = null
    this.width = 0
    this.height = 0
    this.qrCodeSymbol = null
    this.debug = false
    this.error = undefined
    this.result = undefined
  }

  runDecode() {
    this.error = undefined
    if (this.imagedata == null) {
      throw new Error('Image data is not initialized')
    }
    this.result = this.process(this.imagedata)
    return this.result
  }

  async decode(src: DecodeSource, data?: ArrayLike<number>) {
    if (typeof src !== 'string' && src.width !== undefined) {
      this.width = src.width
      this.height = src.height
      this.imagedata = {
        data: Array.from(data ?? src.data),
        width: src.width,
        height: src.height,
      }
      return this.runDecode()
    }

    const imageSrc = src as string
    const ImageCtor = (globalThis as { Image?: BrowserImageConstructor }).Image
    if (ImageCtor == null) {
      throw new TypeError('This source format is not supported in your environment, you need to pass an image buffer with width and height (see https://github.com/edi9999/jsqrcode/blob/master/test/qrcode.js)')
    }

    const image = new ImageCtor()
    image.crossOrigin = 'Anonymous'
    return await new Promise<{ result: string, points: unknown[] }>((resolve, reject) => {
      image.onload = () => {
        const documentRef = (globalThis as { document?: BrowserDocument }).document
        if (documentRef == null) {
          reject(new Error('Document API is not available in this environment'))
          return
        }
        const canvasQr = documentRef.createElement('canvas')
        const context = canvasQr.getContext('2d')
        if (context == null) {
          reject(new Error('Canvas 2D context is not available'))
          return
        }
        const canvasOut = documentRef.getElementById('out-canvas')
        if (canvasOut != null) {
          const outctx = canvasOut.getContext('2d')
          outctx?.clearRect(0, 0, 320, 240)
          outctx?.drawImage(image, 0, 0, 320, 240)
        }
        canvasQr.width = image.width
        canvasQr.height = image.height
        context.drawImage(image, 0, 0)
        this.width = image.width
        this.height = image.height
        try {
          this.imagedata = context.getImageData(0, 0, image.width, image.height)
        }
        catch {
          resolve({
            result: 'Cross domain image reading not supported in your browser! Save it to your computer then drag and drop the file!',
            points: [],
          })
          return
        }

        try {
          resolve(this.runDecode())
        }
        catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      }

      image.src = imageSrc
    })
  }

  decode_utf8(s: string) {
    return decodeURIComponent(escape(s))
  }

  process(imageData: RgbaImageData) {
    const start = Date.now()
    const image = this.grayScaleToBitmap(this.grayscale(imageData))
    const detector = new Detector(image)
    const qrCodeMatrix = detector.detect()
    const reader = Decoder.decode(qrCodeMatrix.bits)
    const data = reader.DataByte
    let str = ''
    for (let i = 0; i < data.length; i++) {
      const chunk = data[i]
      if (typeof chunk === 'string') {
        str += chunk
        continue
      }
      for (let j = 0; j < chunk.length; j++) {
        str += String.fromCharCode(chunk[j])
      }
    }
    const time = Date.now() - start
    if (this.debug) {
      console.warn(`QR Code processing time (ms): ${time}`)
    }
    return { result: this.decode_utf8(str), points: qrCodeMatrix.points }
  }

  getPixel(imageData: RgbaImageData, x: number, y: number) {
    if (imageData.width < x || imageData.height < y) {
      throw new Error('point error')
    }
    const point = (x * 4) + (y * imageData.width * 4)
    return (imageData.data[point] * 33 + imageData.data[point + 1] * 34 + imageData.data[point + 2] * 33) / 100
  }

  binarize(th: number) {
    if (this.imagedata == null) {
      throw new Error('Image data is not initialized')
    }
    const ret = Array.from({ length: this.width * this.height }, (): boolean => false)
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const gray = this.getPixel(this.imagedata, x, y)
        ret[x + y * this.width] = gray <= th
      }
    }
    return ret
  }

  getMiddleBrightnessPerArea(imageData: GrayScaleImageData) {
    const numSqrtArea = 4
    const areaWidth = Math.floor(imageData.width / numSqrtArea)
    const areaHeight = Math.floor(imageData.height / numSqrtArea)
    const minmax = Array.from({ length: numSqrtArea }, () =>
      Array.from({ length: numSqrtArea }, () => [0, 0] as [number, number]))

    for (let ay = 0; ay < numSqrtArea; ay++) {
      for (let ax = 0; ax < numSqrtArea; ax++) {
        minmax[ax][ay][0] = 0xFF
        for (let dy = 0; dy < areaHeight; dy++) {
          for (let dx = 0; dx < areaWidth; dx++) {
            const target = imageData.data[areaWidth * ax + dx + (areaHeight * ay + dy) * imageData.width]
            if (target < minmax[ax][ay][0]) {
              minmax[ax][ay][0] = target
            }
            if (target > minmax[ax][ay][1]) {
              minmax[ax][ay][1] = target
            }
          }
        }
      }
    }

    const middle = Array.from({ length: numSqrtArea }, () =>
      Array.from({ length: numSqrtArea }, (): number => 0))
    for (let ay = 0; ay < numSqrtArea; ay++) {
      for (let ax = 0; ax < numSqrtArea; ax++) {
        middle[ax][ay] = Math.floor((minmax[ax][ay][0] + minmax[ax][ay][1]) / 2)
      }
    }
    return middle
  }

  grayScaleToBitmap(grayScaleImageData: GrayScaleImageData): BinaryImageData {
    const middle = this.getMiddleBrightnessPerArea(grayScaleImageData)
    const sqrtNumArea = middle.length
    const areaWidth = Math.floor(grayScaleImageData.width / sqrtNumArea)
    const areaHeight = Math.floor(grayScaleImageData.height / sqrtNumArea)
    const data = [...grayScaleImageData.data]
    for (let ay = 0; ay < sqrtNumArea; ay++) {
      for (let ax = 0; ax < sqrtNumArea; ax++) {
        for (let dy = 0; dy < areaHeight; dy++) {
          for (let dx = 0; dx < areaWidth; dx++) {
            const index = areaWidth * ax + dx + (areaHeight * ay + dy) * grayScaleImageData.width
            data[index] = Number(data[index] < middle[ax][ay])
          }
        }
      }
    }
    return {
      height: grayScaleImageData.height,
      width: grayScaleImageData.width,
      data: data.map(value => Boolean(value)),
    }
  }

  grayscale(imageData: RgbaImageData): GrayScaleImageData {
    const ret = Array.from({ length: imageData.width * imageData.height }, (): number => 0)
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
}

export function URShift(number: number, bits: number) {
  if (number >= 0) {
    return number >> bits
  }
  return (number >> bits) + (2 << ~bits)
}
