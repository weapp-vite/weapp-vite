// utils.ts
export class Utils {
  // 生成随机字符串
  static randomString(length: number = 8): string {
    return Math.random().toString(36).substring(2, 2 + length)
  }

  // 深拷贝对象
  static deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj))
  }

  // 判断是否为空
  static isEmpty(val: any): boolean {
    if (val == null) return true
    if (typeof val === 'string' || Array.isArray(val)) return val.length === 0
    if (typeof val === 'object') return Object.keys(val).length === 0
    return false
  }

  // 防抖函数
  static debounce<T extends (...args: any[]) => any>(fn: T, delay = 300) {
    let timer: NodeJS.Timeout
    return (...args: Parameters<T>) => {
      clearTimeout(timer)
      timer = setTimeout(() => fn(...args), delay)
    }
  }

  // 节流函数
  static throttle<T extends (...args: any[]) => any>(fn: T, delay = 300) {
    let last = 0
    return (...args: Parameters<T>) => {
      const now = Date.now()
      if (now - last > delay) {
        last = now
        fn(...args)
      }
    }
  }

  // 格式化日期
  static formatDate(date: Date | string, fmt = 'YYYY-MM-DD HH:mm:ss'): string {
    const d = typeof date === 'string' ? new Date(date) : date
    const pad = (n: number) => n.toString().padStart(2, '0')
    return fmt
      .replace('YYYY', d.getFullYear().toString())
      .replace('MM', pad(d.getMonth() + 1))
      .replace('DD', pad(d.getDate()))
      .replace('HH', pad(d.getHours()))
      .replace('mm', pad(d.getMinutes()))
      .replace('ss', pad(d.getSeconds()))
  }

  // 首字母大写
  static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  // 数组去重
  static unique<T>(arr: T[]): T[] {
    return Array.from(new Set(arr))
  }

  // 获取 URL 参数
  static getQueryParam(url: string, key: string): string | null {
    const params = new URL(url, 'http://dummy.com').searchParams
    return params.get(key)
  }
}
