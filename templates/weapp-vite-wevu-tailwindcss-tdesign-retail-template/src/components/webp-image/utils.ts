function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number'
}

function getFileExt(src: string) {
  const fileUrl = src.split('?')[0]
  const splitUrl = fileUrl.split('/')
  const filepath = splitUrl.at(-1) || ''
  return filepath.split('.')[1] || 'jpg'
}

function rpx2px(rpx: number, screenWidth: number) {
  return Math.round((rpx * screenWidth) / 750)
}

function imageMogr(url: string, options?: Record<string, any>) {
  if (!isString(url) || !url) {
    return ''
  }

  if (
    url.includes('qlogo.cn')
    || url.startsWith('wxfile://')
    || url.startsWith('http://tmp/wx')
    || url.includes('imageMogr2')
  ) {
    return url
  }

  if (url.startsWith('http://')) {
    url = url.replace('http://', 'https://')
  }
  else if (url.startsWith('//')) {
    url = `https:${url}`
  }

  if (!options) {
    return url
  }

  const width = Math.ceil(options.width)
  const height = Math.ceil(options.height)
  const format = options.format
  const quality = options.quality ?? 70
  const strip = options.strip ?? true
  const crop = options.crop
  const isValidWidth = isNumber(width) && width > 0
  const isValidHeight = isNumber(height) && height > 0
  let imageMogrStr = ''
  let size = ''

  if (isValidWidth && isValidHeight) {
    size = `${width}x${height}`
  }
  else if (isValidWidth) {
    size = `${width}x`
  }
  else if (isValidHeight) {
    size = `x${height}`
  }

  if (size) {
    imageMogrStr += `/${crop ? 'crop' : 'thumbnail'}/${size}`
    if (crop) {
      imageMogrStr += '/gravity/center'
    }
  }

  if (isNumber(quality)) {
    imageMogrStr += `/quality/${quality}`
  }

  if (strip) {
    imageMogrStr += '/strip'
  }

  const ext = getFileExt(url)
  if (ext === 'gif') {
    imageMogrStr += '/cgif/1'
  }
  else if (format) {
    imageMogrStr += `/format/${format}`
  }

  if (format === 'jpg' || (!format && (ext === 'jpg' || ext === 'jpeg'))) {
    imageMogrStr += '/interlace/1'
  }

  if (!imageMogrStr) {
    return url
  }

  return `${url}${url.includes('?') ? '&' : '?'}imageMogr2${imageMogrStr}`
}

export function getSrc(options: {
  src?: string
  thumbWidth?: number
  thumbHeight?: number
  systemInfo?: { screenWidth?: number, pixelRatio?: number }
  webp?: boolean
  mode?: string
}) {
  if (!options.src) {
    return ''
  }

  if (options.thumbWidth || options.thumbHeight) {
    return imageMogr(options.src, {
      width:
        options.mode !== 'heightFix'
          ? rpx2px(options.thumbWidth || 0, options.systemInfo?.screenWidth || 375)
          * (options.systemInfo?.pixelRatio || 1)
          : null,
      height:
        options.mode !== 'widthFix'
          ? rpx2px(options.thumbHeight || 0, options.systemInfo?.screenWidth || 375)
          * (options.systemInfo?.pixelRatio || 1)
          : null,
      format: options.webp ? 'webp' : null,
    })
  }

  return ''
}
