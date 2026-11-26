/**
 * 标准格式化语义对齐 @a2ui/web_core 0.16.1 的 common/basic_functions。
 * Copyright 2024 Google LLC，Apache-2.0（https://www.apache.org/licenses/LICENSE-2.0）。
 */
import type { A2uiLocale } from './types'

const DATE_TOKENS = /yyyy|yy|MMMM|MMM|MM|M|EEEE|E|dd|d|HH|H|hh|[ha]|mm|ss/g
const ISO_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/
const WRITTEN_FIELDS = /^([+-]?\d{4,6})-(\d{2})-(\d{2})(?:[T ](\d{2})(?::(\d{2})(?::(\d{2}))?)?)?/
const TRAILING_ZEROS = /\.?0+$/

interface DateNames {
  readonly monthsLong: readonly string[]
  readonly monthsShort: readonly string[]
  readonly weekdaysLong: readonly string[]
  readonly weekdaysShort: readonly string[]
}

const DATE_NAMES: Record<A2uiLocale, DateNames> = {
  'zh-CN': {
    monthsLong: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    monthsShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    weekdaysLong: ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'],
    weekdaysShort: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  },
  'en-US': {
    monthsLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    weekdaysLong: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    weekdaysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
}

const CURRENCY_SYMBOLS: Record<A2uiLocale, Readonly<Record<string, string>>> = {
  'zh-CN': {
    CNY: '¥',
    USD: 'US$',
    EUR: '€',
    GBP: '£',
    JPY: 'JP¥',
    KRW: '₩',
    HKD: 'HK$',
    TWD: 'NT$',
    SGD: 'SGD\u00A0',
    AUD: 'AU$',
    CAD: 'CA$',
  },
  'en-US': {
    CNY: 'CN¥',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    KRW: '₩',
    HKD: 'HK$',
    TWD: 'NT$',
    SGD: 'SGD\u00A0',
    AUD: 'A$',
    CAD: 'CA$',
  },
}

const ZERO_FRACTION_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'ISK',
  'ITL',
  'JPY',
  'KMF',
  'KRW',
  'LUF',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'UYI',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
])
const THREE_FRACTION_CURRENCIES = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'])
const FOUR_FRACTION_CURRENCIES = new Set(['CLF', 'UYW'])

function normalizeDecimals(value: unknown, fallback: number): number {
  if (value === undefined) {
    return fallback
  }
  const decimals = Number(value)
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 100) {
    throw new RangeError('Fraction digits must be an integer between 0 and 100.')
  }
  return decimals
}

function groupDigits(value: string): string {
  return value.replace(/(\d)(?=(\d{3})+$)/g, '$1,')
}

function expandDecimal(value: number): string {
  const [coefficient = '0', exponentInput] = Math.abs(value).toString().split('e')
  const exponent = exponentInput === undefined ? 0 : Number(exponentInput)
  const [integer = '0', fraction = ''] = coefficient.split('.')
  const digits = integer + fraction
  const point = integer.length + exponent
  if (point <= 0) {
    return `0.${'0'.repeat(-point)}${digits}`
  }
  if (point >= digits.length) {
    return `${digits}${'0'.repeat(point - digits.length)}`
  }
  return `${digits.slice(0, point)}.${digits.slice(point)}`
}

function incrementDigits(value: string): string {
  const digits = value.split('')
  let carry = 1
  for (let index = digits.length - 1; index >= 0 && carry > 0; index -= 1) {
    const next = Number(digits[index]) + carry
    digits[index] = String(next % 10)
    carry = Math.floor(next / 10)
  }
  if (carry > 0) {
    digits.unshift('1')
  }
  return digits.join('')
}

function formatFixed(value: number, places: number): string {
  const [integer = '0', fraction = ''] = expandDecimal(value).split('.')
  if (fraction.length <= places) {
    return places === 0 ? integer : `${integer}.${fraction.padEnd(places, '0')}`
  }
  const kept = fraction.slice(0, places)
  const combined = integer + kept
  const rounded = fraction.charAt(places) >= '5' ? incrementDigits(combined) : combined
  if (places === 0) {
    return rounded
  }
  return `${rounded.slice(0, -places) || '0'}.${rounded.slice(-places)}`
}

function defaultCurrencyDecimals(currency: string): number {
  if (ZERO_FRACTION_CURRENCIES.has(currency)) {
    return 0
  }
  if (THREE_FRACTION_CURRENCIES.has(currency)) {
    return 3
  }
  return FOUR_FRACTION_CURRENCIES.has(currency) ? 4 : 2
}

export function formatA2uiNumber(value: unknown, decimals?: unknown, grouping: unknown = true): string {
  const number = Number(value)
  if (Number.isNaN(number)) {
    return ''
  }
  if (!Number.isFinite(number)) {
    return number < 0 ? '-∞' : '∞'
  }
  const places = normalizeDecimals(decimals, 3)
  const negative = number < 0 || Object.is(number, -0)
  let formatted = `${negative ? '-' : ''}${formatFixed(Math.abs(number), places)}`
  if (decimals === undefined) {
    formatted = formatted.replace(TRAILING_ZEROS, '')
  }
  if (grouping === false) {
    return formatted
  }
  const unsigned = negative ? formatted.slice(1) : formatted
  const [integer = '0', fraction] = unsigned.split('.')
  return `${negative ? '-' : ''}${groupDigits(integer)}${fraction === undefined ? '' : `.${fraction}`}`
}

export function formatA2uiCurrency(
  value: unknown,
  currencyInput: unknown,
  decimals?: unknown,
  grouping: unknown = true,
  locale: A2uiLocale = 'zh-CN',
): string {
  const number = Number(value)
  if (Number.isNaN(number)) {
    return ''
  }
  const currency = String(currencyInput).toUpperCase()
  const symbol = CURRENCY_SYMBOLS[locale][currency] ?? `${currency}\u00A0`
  const formatted = formatA2uiNumber(number, normalizeDecimals(decimals, defaultCurrencyDecimals(currency)), grouping)
  const negative = formatted.startsWith('-')
  return `${negative ? '-' : ''}${symbol}${negative ? formatted.slice(1) : formatted}`
}

interface ParsedTimestamp {
  readonly shifted: Date
  readonly instant: Date
}

function fieldsRoundTrip(value: string, shifted: Date): boolean {
  const written = WRITTEN_FIELDS.exec(value)
  if (!written) {
    return false
  }
  const field = (group: number) => written[group] === undefined ? undefined : Number(written[group])
  return field(1) === shifted.getUTCFullYear()
    && field(2) === shifted.getUTCMonth() + 1
    && field(3) === shifted.getUTCDate()
    && (field(4) ?? shifted.getUTCHours()) === shifted.getUTCHours()
    && (field(5) ?? shifted.getUTCMinutes()) === shifted.getUTCMinutes()
    && (field(6) ?? shifted.getUTCSeconds()) === shifted.getUTCSeconds()
}

function parseTimestamp(value: string): ParsedTimestamp | undefined {
  const instant = new Date(ISO_OFFSET.test(value) ? value : `${value}Z`)
  if (Number.isNaN(instant.getTime())) {
    return undefined
  }
  const match = /([+-])(\d{2}):?(\d{2})$/.exec(value)
  const offsetMinutes = match
    ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]))
    : 0
  const shifted = new Date(instant.getTime() + offsetMinutes * 60_000)
  return fieldsRoundTrip(value, shifted) ? { shifted, instant } : undefined
}

export function formatA2uiDate(
  value: unknown,
  formatInput?: unknown,
  locale: A2uiLocale = 'zh-CN',
): string {
  if (!value) {
    return ''
  }
  const parsed = parseTimestamp(String(value))
  if (!parsed) {
    return ''
  }
  const pattern = formatInput ? String(formatInput) : 'yyyy-MM-dd'
  if (pattern === 'ISO') {
    return parsed.instant.toISOString()
  }
  const { shifted } = parsed
  const names = DATE_NAMES[locale]
  const weekdayIndex = (shifted.getUTCDay() + 6) % 7
  const hours = shifted.getUTCHours()
  const hours12 = hours % 12 || 12
  return pattern.replace(DATE_TOKENS, (token) => {
    switch (token) {
      case 'yyyy': return String(shifted.getUTCFullYear())
      case 'yy': return String(shifted.getUTCFullYear()).slice(-2)
      case 'MMMM': return names.monthsLong[shifted.getUTCMonth()]!
      case 'MMM': return names.monthsShort[shifted.getUTCMonth()]!
      case 'MM': return String(shifted.getUTCMonth() + 1).padStart(2, '0')
      case 'M': return String(shifted.getUTCMonth() + 1)
      case 'EEEE': return names.weekdaysLong[weekdayIndex]!
      case 'E': return names.weekdaysShort[weekdayIndex]!
      case 'dd': return String(shifted.getUTCDate()).padStart(2, '0')
      case 'd': return String(shifted.getUTCDate())
      case 'HH': return String(hours).padStart(2, '0')
      case 'H': return String(hours)
      case 'hh': return String(hours12).padStart(2, '0')
      case 'h': return String(hours12)
      case 'mm': return String(shifted.getUTCMinutes()).padStart(2, '0')
      case 'ss': return String(shifted.getUTCSeconds()).padStart(2, '0')
      case 'a': return hours < 12 ? 'AM' : 'PM'
      default: return token
    }
  })
}

export function formatA2uiPluralize(
  value: unknown,
  forms: Record<string, unknown>,
  locale: A2uiLocale = 'zh-CN',
): string {
  const category = locale === 'zh-CN' || Number(value) !== 1 ? 'other' : 'one'
  return String(forms[category] ?? forms.other ?? '')
}
