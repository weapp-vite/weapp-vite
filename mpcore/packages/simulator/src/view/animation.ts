import type {
  HeadlessWxAnimation,
  HeadlessWxAnimationAction,
  HeadlessWxAnimationExportResult,
  HeadlessWxAnimationStepOption,
} from '../host'

const DEFAULT_STEP_OPTION: Required<HeadlessWxAnimationStepOption> = {
  delay: 0,
  duration: 400,
  timingFunction: 'linear',
  transformOrigin: '50% 50% 0',
}

function normalizeStepOption(option?: HeadlessWxAnimationStepOption) {
  return {
    delay: option?.delay ?? DEFAULT_STEP_OPTION.delay,
    duration: option?.duration ?? DEFAULT_STEP_OPTION.duration,
    timingFunction: option?.timingFunction ?? DEFAULT_STEP_OPTION.timingFunction,
    transformOrigin: option?.transformOrigin ?? DEFAULT_STEP_OPTION.transformOrigin,
  }
}

function normalizeLength(value: number | string | undefined) {
  if (typeof value === 'number') {
    return `${value}px`
  }
  return value ?? '0px'
}

function createAction(type: string, args: unknown[]): HeadlessWxAnimationAction {
  return {
    args,
    type,
  }
}

export function createHeadlessAnimation(defaultOption?: HeadlessWxAnimationStepOption): HeadlessWxAnimation {
  const baseOption = normalizeStepOption(defaultOption)
  let currentActions: HeadlessWxAnimationAction[] = []
  let queue: Array<{ animates: HeadlessWxAnimationAction[], option: Required<HeadlessWxAnimationStepOption> }> = []
  let animation!: HeadlessWxAnimation

  const append = (type: string, args: unknown[]) => {
    currentActions.push(createAction(type, args))
    return animation
  }

  animation = {
    backgroundColor(value) {
      return append('backgroundColor', [value])
    },
    bottom(value) {
      return append('bottom', [normalizeLength(value)])
    },
    export(): HeadlessWxAnimationExportResult {
      const exported = queue.map(item => ({
        animates: item.animates.map(action => ({
          args: [...action.args],
          type: action.type,
        })),
        option: { ...item.option },
      }))
      queue = []
      currentActions = []
      return {
        actions: exported,
      }
    },
    height(value) {
      return append('height', [normalizeLength(value)])
    },
    left(value) {
      return append('left', [normalizeLength(value)])
    },
    opacity(value) {
      return append('opacity', [value])
    },
    right(value) {
      return append('right', [normalizeLength(value)])
    },
    rotate(angle) {
      return append('rotate', [`${angle}deg`])
    },
    scale(sx, sy) {
      return append('scale', [sx, sy ?? sx])
    },
    step(option) {
      queue.push({
        animates: currentActions.map(action => ({
          args: [...action.args],
          type: action.type,
        })),
        option: {
          ...baseOption,
          ...(option ?? {}),
        },
      })
      currentActions = []
      return animation
    },
    top(value) {
      return append('top', [normalizeLength(value)])
    },
    translate(tx, ty) {
      return append('translate', [normalizeLength(tx), normalizeLength(ty)])
    },
    translate3d(tx, ty, tz) {
      return append('translate3d', [normalizeLength(tx), normalizeLength(ty), normalizeLength(tz)])
    },
    translateX(translation) {
      return append('translateX', [normalizeLength(translation)])
    },
    translateY(translation) {
      return append('translateY', [normalizeLength(translation)])
    },
    translateZ(translation) {
      return append('translateZ', [normalizeLength(translation)])
    },
    width(value) {
      return append('width', [normalizeLength(value)])
    },
  }

  return animation
}
