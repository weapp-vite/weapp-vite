export function hasPromotion(code: string) {
  return Boolean(code && code !== 'EMPTY_PROMOTION')
}

export function imgCut(url: string, width: number, height: number) {
  if (
    url
    && (url.startsWith('http:')
      || url.startsWith('https:')
      || url.startsWith('//'))
  ) {
    const argsStr = `imageMogr2/thumbnail/!${width}x${height}r`
    url = `${url}${url.includes('?') ? '&' : '?'}${argsStr}`
    if (url.startsWith('http:')) {
      url = `https://${url.slice(5)}`
    }
    if (url.startsWith('//')) {
      url = `https:${url}`
    }
  }
  return url
}
