export function normalizeGeoNumber(value: unknown, fallback = 0) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback
  }
  return value
}

export function normalizeFuzzyCoordinate(value: number) {
  return Number(value.toFixed(2))
}

export function readPresetFuzzyLocation() {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebFuzzyLocation
  if (!preset || typeof preset !== 'object') {
    return null
  }
  const value = preset as Record<string, unknown>
  const latitude = Number(value.latitude)
  const longitude = Number(value.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }
  return {
    latitude: normalizeFuzzyCoordinate(latitude),
    longitude: normalizeFuzzyCoordinate(longitude),
    accuracy: Math.max(1000, normalizeGeoNumber(value.accuracy, 1000)),
  }
}

export function readPresetChooseLocation() {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebChooseLocation
  if (!preset || typeof preset !== 'object') {
    return null
  }
  const value = preset as Record<string, unknown>
  const latitude = Number(value.latitude)
  const longitude = Number(value.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }
  return {
    name: typeof value.name === 'string' ? value.name : '',
    address: typeof value.address === 'string' ? value.address : '',
    latitude,
    longitude,
  }
}

export function readPresetChooseAddress() {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebChooseAddress
  if (!preset || typeof preset !== 'object') {
    return null
  }
  const value = preset as Record<string, unknown>
  return {
    userName: typeof value.userName === 'string' ? value.userName : '',
    postalCode: typeof value.postalCode === 'string' ? value.postalCode : '',
    provinceName: typeof value.provinceName === 'string' ? value.provinceName : '',
    cityName: typeof value.cityName === 'string' ? value.cityName : '',
    countyName: typeof value.countyName === 'string' ? value.countyName : '',
    detailInfo: typeof value.detailInfo === 'string' ? value.detailInfo : '',
    nationalCode: typeof value.nationalCode === 'string' ? value.nationalCode : '',
    telNumber: typeof value.telNumber === 'string' ? value.telNumber : '',
  }
}
