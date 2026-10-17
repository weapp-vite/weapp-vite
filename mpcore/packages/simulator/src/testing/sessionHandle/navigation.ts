import type { HeadlessSession } from '../../runtime'

/** 所有测试句柄通过同一个 wx 导航边界等待成功、失败或关闭通知。 */
export class HeadlessTestingNavigation {
  private readonly pending = new Set<(error: unknown) => void>()

  constructor(private readonly session: HeadlessSession) {
    session.on('close', () => {
      for (const reject of this.pending) {
        reject(new Error('The headless testing session closed before navigation completed.'))
      }
      this.pending.clear()
    })
  }

  invoke(methodName: string, options: { url?: string, delta?: number }) {
    return new Promise<void>((resolve, reject) => {
      const rejectNavigation = (error: unknown) => {
        this.pending.delete(rejectNavigation)
        reject(error)
      }
      this.pending.add(rejectNavigation)
      try {
        this.session.callWxMethod(methodName, {
          ...options,
          success: () => {
            this.pending.delete(rejectNavigation)
            resolve()
          },
          fail: (error: unknown) => {
            const details = error && typeof error === 'object' ? error as { errMsg?: unknown, message?: unknown } : undefined
            const reason = typeof details?.errMsg === 'string'
              ? details.errMsg
              : typeof details?.message === 'string' ? details.message : String(error)
            const target = options.url ? ` route "${options.url}"` : ''
            rejectNavigation(new Error(`Failed to ${methodName}${target} through the headless wx runtime: ${reason}`, { cause: error }))
          },
        })
      }
      catch (error) {
        rejectNavigation(error)
      }
    })
  }
}
