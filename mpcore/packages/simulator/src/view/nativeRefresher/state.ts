import type { RuntimeScheduler } from '../../kernel/scheduler'
import type { HeadlessTestingNodeEventInit, HeadlessTestingTouch } from '../nodeEvents'

type Phase = 'idle' | 'pulling' | 'armed' | 'refreshing' | 'restoring'
interface Gesture { id: number, x: number, y: number, claimed: boolean }
const RESTORE_DURATION = 180

function point(touch: HeadlessTestingTouch) {
  return { id: touch.identifier ?? 0, x: Number(touch.clientX ?? touch.pageX ?? 0), y: Number(touch.clientY ?? touch.pageY ?? 0) }
}

/** 仅保存原生刷新交互，不回写 AppService 的受控数据或滚动位置。 */
export class NativeRefresherState {
  private phase: Phase = 'idle'
  private gesture?: Gesture
  private dy = 0
  private timer?: ReturnType<typeof setTimeout>
  private enabled = false
  private threshold = 45
  private generation = 0

  constructor(
    private readonly scheduler: RuntimeScheduler,
    private readonly emit: (name: string, detail: { dy: number }) => void,
  ) {}

  configure(enabled: boolean, threshold: string | undefined) {
    this.enabled = enabled
    const value = Number(threshold ?? 45)
    this.threshold = Number.isFinite(value) && value >= 0 ? value : 45
    if (!enabled) {
      this.cancel()
    }
  }

  commit(triggered: boolean) {
    if (!this.enabled || this.phase === 'restoring') {
      return
    }
    if (triggered && this.phase !== 'refreshing') {
      this.refresh(true)
    }
    else if (!triggered && this.phase !== 'idle') {
      this.restore(this.phase === 'refreshing' ? 'refresherrestore' : 'refresherabort')
    }
  }

  dispatch(name: string, event: HeadlessTestingNodeEventInit, scrollTop: number) {
    if (!this.enabled) {
      return
    }
    const touches = event.touches ?? []
    if (name === 'touchstart') {
      if (this.phase === 'idle' && touches.length === 1 && scrollTop === 0) {
        this.gesture = { ...point(touches[0]!), claimed: false }
      }
      return
    }
    const gesture = this.gesture
    if (!gesture) {
      return
    }
    if (name === 'touchcancel') {
      this.gesture = undefined
      if (gesture.claimed) {
        this.restore('refresherabort')
      }
      return
    }
    if (name === 'touchend') {
      if (touches.some(touch => (touch.identifier ?? 0) === gesture.id)) {
        return
      }
      this.gesture = undefined
      if (gesture.claimed) {
        if (this.phase === 'armed') {
          this.refresh(false)
        }
        else {
          this.restore('refresherabort')
        }
      }
      return
    }
    const touch = touches.find(touch => (touch.identifier ?? 0) === gesture.id)
    if (!touch || touches.length !== 1 || scrollTop > 0) {
      this.dispatch('touchcancel', {}, scrollTop)
      return
    }
    const position = point(touch)
    const dy = position.y - gesture.y
    const dx = Math.abs(position.x - gesture.x)
    if (!gesture.claimed) {
      if (Math.max(Math.abs(dy), dx) < 4) {
        return
      }
      if (dy <= dx) {
        this.gesture = undefined
        return
      }
      gesture.claimed = true
    }
    this.dy = Math.min(Math.max(0, dy / 2), this.threshold * 2)
    this.phase = this.dy >= this.threshold ? 'armed' : 'pulling'
    this.emit('refresherpulling', { dy: this.dy })
  }

  cancel() {
    this.generation++
    if (this.timer !== undefined) {
      this.scheduler.clearTimeout(this.timer)
      this.timer = undefined
    }
    this.gesture = undefined
    this.phase = 'idle'
    this.dy = 0
  }

  private refresh(programmatic: boolean) {
    const dy = this.dy
    this.cancel()
    const generation = this.generation
    this.phase = 'refreshing'
    this.dy = this.threshold + 10
    if (programmatic) {
      this.timer = this.scheduler.setTimeout(() => {
        if (generation === this.generation) {
          this.timer = undefined
          this.emit('refresherrefresh', { dy: this.dy })
        }
      }, RESTORE_DURATION)
      this.emit('refresherpulling', { dy: this.dy })
    }
    else {
      this.emit('refresherrefresh', { dy })
    }
  }

  private restore(name: 'refresherrestore' | 'refresherabort') {
    const dy = this.dy
    this.cancel()
    const generation = this.generation
    this.phase = 'restoring'
    this.timer = this.scheduler.setTimeout(() => {
      if (generation === this.generation) {
        this.timer = undefined
        this.phase = 'idle'
      }
    }, RESTORE_DURATION)
    this.emit(name, { dy })
  }
}
