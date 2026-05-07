export function hasOwn(source: object, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(source, key)
}
