import { posix as path } from 'pathe'

export function replaceAll(source: string, searchValue: string, replaceValue: string) {
  if (!searchValue) {
    return source
  }
  if (source.includes(searchValue)) {
    return source.split(searchValue).join(replaceValue)
  }
  if (searchValue.startsWith('./') && replaceValue.startsWith('./')) {
    const trimmedSearch = searchValue.slice(2)
    const trimmedReplace = replaceValue.slice(2)
    if (trimmedSearch && source.includes(trimmedSearch)) {
      return source.split(trimmedSearch).join(trimmedReplace)
    }
  }
  return source
}

export function containsImportSpecifier(source: string, specifier: string) {
  if (!specifier) {
    return false
  }
  if (source.includes(specifier)) {
    return true
  }
  if (specifier.startsWith('./')) {
    const trimmed = specifier.slice(2)
    if (trimmed && source.includes(trimmed)) {
      return true
    }
  }
  return false
}

export function hasInCollection(collection: unknown, value: string) {
  if (!collection || !value) {
    return false
  }
  if (collection instanceof Set) {
    return collection.has(value)
  }
  if (Array.isArray(collection)) {
    return collection.includes(value)
  }
  if (collection instanceof Map) {
    return collection.has(value)
  }
  return false
}

export function createRelativeImport(fromFile: string, toFile: string) {
  const relative = path.relative(path.dirname(fromFile), toFile)
  if (!relative || relative.startsWith('.')) {
    return relative || './'
  }
  return `./${relative}`
}
