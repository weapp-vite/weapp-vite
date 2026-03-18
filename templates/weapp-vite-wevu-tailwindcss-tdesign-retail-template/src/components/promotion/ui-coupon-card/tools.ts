export function isBigValue(value: string | number) {
  const values = `${value}`.split('.')
  return Boolean(values[1] && values[0].length >= 3)
}

export function getBigValues(value: string | number) {
  return `${value}`.split('.')
}
