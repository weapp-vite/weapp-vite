export interface RpxConfig {
  designWidth?: number
  varName?: string
}

const DEFAULT_DESIGN_WIDTH = 750
const DEFAULT_VAR_NAME = '--rpx'
let initialized = false

function computeRpx(designWidth: number) {
  if (typeof window === 'undefined') {
    return 0
  }
  const width = document.documentElement?.clientWidth ?? window.innerWidth
  return width / designWidth
}

export function setupRpx(config?: RpxConfig) {
  if (typeof document === 'undefined') {
    return
  }
  const designWidth = config?.designWidth ?? DEFAULT_DESIGN_WIDTH
  const varName = config?.varName ?? DEFAULT_VAR_NAME
  const root = document.documentElement
  const apply = () => {
    const value = computeRpx(designWidth)
    root.style.setProperty(varName, `${value}px`)
  }
  apply()
  if (!initialized) {
    initialized = true
    window.addEventListener('resize', apply)
  }
}
