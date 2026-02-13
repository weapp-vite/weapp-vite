import {
  createTempFilePath,
  inferChooseMediaFileType,
  pickChooseMediaFiles,
} from './mediaPicker'

export function normalizeCompressImageQuality(quality: number | undefined) {
  if (typeof quality !== 'number' || Number.isNaN(quality)) {
    return 80
  }
  return Math.max(0, Math.min(100, Math.round(quality)))
}

function resolveCompressImageMimeType(src: string) {
  const lower = src.toLowerCase()
  if (lower.includes('.jpg') || lower.includes('.jpeg')) {
    return 'image/jpeg'
  }
  if (lower.includes('.webp')) {
    return 'image/webp'
  }
  return 'image/png'
}

export async function compressImageByCanvas(src: string, quality: number) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return src
  }
  const ImageCtor = (globalThis as { Image?: typeof Image }).Image
  if (typeof ImageCtor !== 'function') {
    return src
  }
  const canvas = document.createElement('canvas') as HTMLCanvasElement
  if (!canvas || typeof canvas.getContext !== 'function') {
    return src
  }
  return new Promise<string>((resolve, reject) => {
    const image = new ImageCtor()
    image.onload = () => {
      try {
        const width = Number((image as { naturalWidth?: number }).naturalWidth ?? image.width ?? 0)
        const height = Number((image as { naturalHeight?: number }).naturalHeight ?? image.height ?? 0)
        const context = canvas.getContext('2d')
        if (!context || typeof context.drawImage !== 'function' || width <= 0 || height <= 0) {
          resolve(src)
          return
        }
        canvas.width = width
        canvas.height = height
        context.drawImage(image, 0, 0, width, height)
        if (typeof canvas.toDataURL !== 'function') {
          resolve(src)
          return
        }
        const dataUrl = canvas.toDataURL(resolveCompressImageMimeType(src), quality / 100)
        resolve(dataUrl || src)
      }
      catch (error) {
        reject(error)
      }
    }
    image.onerror = () => {
      reject(new Error('image load error'))
    }
    image.src = src
  })
}

export function normalizeChooseVideoFile(file: {
  size?: number
  type?: string
  name?: string
}) {
  if (inferChooseMediaFileType(file) !== 'video') {
    return null
  }
  return {
    tempFilePath: createTempFilePath(file),
    duration: 0,
    size: typeof file.size === 'number' ? file.size : 0,
    height: 0,
    width: 0,
  }
}

export async function pickChooseVideoFile() {
  const files = await pickChooseMediaFiles(1, new Set(['video']))
  return files[0] ?? null
}
