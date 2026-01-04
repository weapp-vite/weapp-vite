const CONSTRUCTOR_TYPE_MAP: Record<string, string> = {
  String: 'string',
  StringConstructor: 'string',
  Number: 'number',
  NumberConstructor: 'number',
  Boolean: 'boolean',
  BooleanConstructor: 'boolean',
  Object: 'Record<string, any>',
  ObjectConstructor: 'Record<string, any>',
  Array: 'any[]',
  ArrayConstructor: 'any[]',
  null: 'any',
  Null: 'any',
  NullConstructor: 'any',
}

export function mapConstructorName(name: string) {
  if (Object.hasOwn(CONSTRUCTOR_TYPE_MAP, name)) {
    return CONSTRUCTOR_TYPE_MAP[name]
  }
  const normalized = name.endsWith('Constructor')
    ? name.slice(0, -'Constructor'.length)
    : name
  return CONSTRUCTOR_TYPE_MAP[normalized] ?? 'any'
}
