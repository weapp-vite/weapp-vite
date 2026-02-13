type VibrateType = 'heavy' | 'medium' | 'light' | undefined

interface BatterySnapshot {
  level: number
  isCharging: boolean
}

function resolveVibrateDuration(type: VibrateType) {
  if (type === 'heavy') {
    return 30
  }
  if (type === 'medium') {
    return 20
  }
  return 15
}

export function vibrateDevice(type: VibrateType) {
  const runtimeNavigator = (typeof navigator !== 'undefined' ? navigator : undefined) as (Navigator & {
    vibrate?: (pattern: number | number[]) => boolean
  }) | undefined
  if (!runtimeNavigator || typeof runtimeNavigator.vibrate !== 'function') {
    throw new Error('vibrate is unavailable')
  }
  runtimeNavigator.vibrate(resolveVibrateDuration(type))
}

function normalizeBatteryLevel(level: unknown) {
  if (typeof level !== 'number' || Number.isNaN(level)) {
    return 100
  }
  const value = Math.round(level * 100)
  return Math.min(100, Math.max(0, value))
}

let cachedBatteryInfo: BatterySnapshot = {
  level: 100,
  isCharging: false,
}

async function readRuntimeBatteryInfoInternal() {
  const runtimeNavigator = (typeof navigator !== 'undefined' ? navigator : undefined) as (Navigator & {
    getBattery?: () => Promise<{ charging?: boolean, level?: number }>
  }) | undefined
  if (runtimeNavigator && typeof runtimeNavigator.getBattery === 'function') {
    const battery = await runtimeNavigator.getBattery()
    const nextInfo: BatterySnapshot = {
      level: normalizeBatteryLevel(battery?.level),
      isCharging: Boolean(battery?.charging),
    }
    cachedBatteryInfo = nextInfo
    return nextInfo
  }
  return cachedBatteryInfo
}

export function readBatteryInfoSyncSnapshot() {
  void readRuntimeBatteryInfoInternal().catch(() => {})
  return {
    ...cachedBatteryInfo,
  }
}

export function readBatteryInfoSnapshot() {
  return readRuntimeBatteryInfoInternal()
}
