const VALID_IDENTIFIER_RE = /^[A-Z_$][\w$]*$/i

export function isValidIdentifierName(name: string) {
  return VALID_IDENTIFIER_RE.test(name)
}

export function formatPropertyKey(name: string) {
  if (isValidIdentifierName(name)) {
    return name
  }
  const escaped = name
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\\\'')
  return `'${escaped}'`
}
