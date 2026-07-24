import { getWebViewportWidth } from './viewport'

export interface RpxConfig {
  designWidth?: number
  varName?: string
}

const DEFAULT_DESIGN_WIDTH = 750
const DEFAULT_VAR_NAME = '--rpx'
let initialized = false
let activeConfig = {
  designWidth: DEFAULT_DESIGN_WIDTH,
  varName: DEFAULT_VAR_NAME,
}

function computeRpx(designWidth: number) {
  if (typeof window === 'undefined') {
    return 0
  }
  const width = getWebViewportWidth()
  return width / designWidth
}

function applyRpx() {
  const root = document.documentElement
  const value = computeRpx(activeConfig.designWidth)
  root.style.setProperty(activeConfig.varName, `${value}px`)
}

export function setupRpx(config?: RpxConfig) {
  if (typeof document === 'undefined') {
    return
  }
  activeConfig = {
    designWidth: config?.designWidth ?? DEFAULT_DESIGN_WIDTH,
    varName: config?.varName ?? DEFAULT_VAR_NAME,
  }
  const apply = () => applyRpx()
  apply()
  if (!initialized) {
    initialized = true
    window.addEventListener('resize', apply)
  }
}
