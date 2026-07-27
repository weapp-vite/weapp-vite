export interface WebAnimationStepOptions {
  delay?: number
  duration?: number
  timingFunction?: string
  transformOrigin?: string
}

interface WebAnimationOperation {
  type: string
  args: unknown[]
}

interface WebAnimationStep {
  animates: WebAnimationOperation[]
  option: WebAnimationStepOptions
}

export class WebAnimation {
  #actions: WebAnimationStep[] = []
  #operations: WebAnimationOperation[] = []

  constructor(private readonly defaults: WebAnimationStepOptions = {}) {}

  #add(type: string, ...args: unknown[]) {
    this.#operations.push({ type, args })
    return this
  }

  backgroundColor(value: string) { return this.#add('backgroundColor', value) }
  bottom(value: number | string) { return this.#add('bottom', value) }
  height(value: number | string) { return this.#add('height', value) }
  left(value: number | string) { return this.#add('left', value) }
  matrix(...args: number[]) { return this.#add('matrix', ...args) }
  matrix3d(...args: number[]) { return this.#add('matrix3d', ...args) }
  opacity(value: number) { return this.#add('opacity', value) }
  right(value: number | string) { return this.#add('right', value) }
  rotate(angle: number) { return this.#add('rotate', angle) }
  rotate3d(x: number, y: number, z: number, angle: number) { return this.#add('rotate3d', x, y, z, angle) }
  rotateX(angle: number) { return this.#add('rotateX', angle) }
  rotateY(angle: number) { return this.#add('rotateY', angle) }
  rotateZ(angle: number) { return this.#add('rotateZ', angle) }
  scale(x: number, y?: number) { return this.#add('scale', x, y ?? x) }
  scale3d(x: number, y: number, z: number) { return this.#add('scale3d', x, y, z) }
  scaleX(value: number) { return this.#add('scaleX', value) }
  scaleY(value: number) { return this.#add('scaleY', value) }
  scaleZ(value: number) { return this.#add('scaleZ', value) }
  skew(x: number, y: number) { return this.#add('skew', x, y) }
  skewX(angle: number) { return this.#add('skewX', angle) }
  skewY(angle: number) { return this.#add('skewY', angle) }
  top(value: number | string) { return this.#add('top', value) }
  translate(x: number, y?: number) { return this.#add('translate', x, y ?? 0) }
  translate3d(x: number, y: number, z: number) { return this.#add('translate3d', x, y, z) }
  translateX(value: number) { return this.#add('translateX', value) }
  translateY(value: number) { return this.#add('translateY', value) }
  translateZ(value: number) { return this.#add('translateZ', value) }
  width(value: number | string) { return this.#add('width', value) }

  step(options: WebAnimationStepOptions = {}) {
    this.#actions.push({
      animates: this.#operations.splice(0),
      option: { ...this.defaults, ...options },
    })
    return this
  }

  export() {
    return { actions: this.#actions.splice(0) }
  }
}

export function createAnimation(options: WebAnimationStepOptions = {}) {
  return new WebAnimation(options)
}
