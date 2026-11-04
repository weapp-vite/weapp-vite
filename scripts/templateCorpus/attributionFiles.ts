const extension = '(?:\\.(?:txt|md|markdown|rst|text|html?))?'
const standardGrant = new RegExp(`^(?:licen[cs]e|copying)(?:[._-]?\\d+)?${extension}$`, 'i')
const variant = '(?:mit|apache(?:[-_.]?2(?:\\.0)?)?|bsd(?:[-_.]?[23](?:[-_.]clause)?)?|isc|mpl(?:[-_.]?2(?:\\.0)?)?|[al]?gpl(?:[-_.]?[23](?:\\.0)?)?|cc0|unlicense|[a-z]{2}(?:[-_][a-z]{2})?)'
const namedGrant = new RegExp(`^(?:licen[cs]e|copying)[._-]${variant}${extension}$`, 'i')
const notice = new RegExp(`^notice${extension}$`, 'i')

/** 许可文件编号不代表版本或双重许可，只决定必须读取其实际 grant。 */
export function isLicenseGrantFile(file: string): boolean {
  const basename = file.split('/').at(-1)!
  return standardGrant.test(basename) || namedGrant.test(basename)
}

/** 采集与授权范围共用命名规则；普通组件、图片和源码不冒充归属声明。 */
export function isAttributionFile(file: string): boolean {
  return isLicenseGrantFile(file) || notice.test(file.split('/').at(-1)!)
}
