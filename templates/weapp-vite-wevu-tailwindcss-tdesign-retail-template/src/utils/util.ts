// @ts-nocheck
import dayjs from 'dayjs'

const formatTime = (date: dayjs.ConfigType, template: string) => dayjs(date).format(template)
const LEFT_BRACKET_RE = /\[/g
const RIGHT_BRACKET_RE = /\]/g
const PHONE_ENCRYPTION_RE = /(\d{3})\d{4}(\d{4})/
const INNER_PHONE_REGEXP = /^1(?:3\d|4[4-9]|5[0-35-9]|6[67]|7[0-8]|8\d|9\d)\d{8}$/

/**
 * 格式化价格数额为字符串
 * 可对小数部分进行填充，默认不填充
 * @param price 价格数额，以分为单位!
 * @param fill 是否填充小数部分 0-不填充 1-填充第一位小数 2-填充两位小数
 */
function priceFormat(price: number | string | null, fill = 0) {
  if (Number.isNaN(Number(price)) || price === null || price === Infinity) {
    return price
  }

  const normalizedValue = Math.round(Number.parseFloat(`${price}`) * 10 ** 8) / 10 ** 8 // 恢复精度丢失
  let priceFormatValue = `${Math.ceil(normalizedValue) / 100}` // 向上取整，单位转换为元，转换为字符串
  if (fill > 0) {
    // 补充小数位数
    if (!priceFormatValue.includes('.')) {
      priceFormatValue = `${priceFormatValue}.`
    }
    const n = fill - priceFormatValue.split('.')[1]?.length
    for (let i = 0; i < n; i++) {
      priceFormatValue = `${priceFormatValue}0`
    }
  }
  return priceFormatValue
}

/**
 * 获取cdn裁剪后链接
 *
 * @param {string} url 基础链接
 * @param {number} width 宽度，单位px
 * @param {number} [height] 可选，高度，不填时与width同值
 */
function cosThumb(url: string, width: number, height = width) {
  if (url.includes('?')) {
    return url
  }

  if (url.indexOf('http://') === 0) {
    url = url.replace('http://', 'https://')
  }

  return `${url}?imageMogr2/thumbnail/${~~width}x${~~height}`
}

function get(source: any, paths: string | string[], defaultValue: unknown) {
  if (typeof paths === 'string') {
    paths = paths
      .replace(LEFT_BRACKET_RE, '.')
      .replace(RIGHT_BRACKET_RE, '')
      .split('.')
      .filter(Boolean)
  }
  const { length } = paths
  let index = 0
  while (source != null && index < length) {
    source = source[paths[index++]]
  }
  return source === undefined || index === 0 ? defaultValue : source
}
let systemWidth = 0
/** 获取系统宽度，为了减少启动消耗所以在函数里边做初始化 */
export function loadSystemWidth() {
  if (systemWidth) {
    return systemWidth
  }

  try {
    const { screenWidth } = wx.getSystemInfoSync()
    systemWidth = screenWidth
  }
  catch (e) {
    systemWidth = 0
  }
  return systemWidth
}

/**
 * 转换rpx为px
 *
 * @description
 * 什么时候用？
 * - 布局(width: 172rpx)已经写好, 某些组件只接受px作为style或者prop指定
 *
 */
function rpx2px(rpx: number, round = false) {
  loadSystemWidth()

  // px / systemWidth = rpx / 750
  const result = (rpx * systemWidth) / 750

  if (round) {
    return Math.floor(result)
  }

  return result
}

/**
 * 手机号码*加密函数
 * @param {string} phone 电话号
 * @returns
 */
function phoneEncryption(phone: string) {
  return phone.replace(PHONE_ENCRYPTION_RE, '$1****$2')
}

// 内置手机号正则字符串
const innerPhoneReg
  = '^1(?:3\\d|4[4-9]|5[0-35-9]|6[67]|7[0-8]|8\\d|9\\d)\\d{8}$'

/**
 * 手机号正则校验
 * @param phone 手机号
 * @param phoneReg 正则字符串
 * @returns true - 校验通过 false - 校验失败
 */
function phoneRegCheck(phone: string) {
  return INNER_PHONE_REGEXP.test(phone)
}

export {
  cosThumb,
  formatTime,
  get,
  phoneEncryption,
  phoneRegCheck,
  priceFormat,
  rpx2px,
}
