export interface WeapiDocGroup {
  key: string
  label: string
  letters: string
}

export const WEAPI_DOC_GROUPS: WeapiDocGroup[] = [
  { key: 'a-c', label: 'A-C', letters: 'abc' },
  { key: 'd-g', label: 'D-G', letters: 'defg' },
  { key: 'h-m', label: 'H-M', letters: 'hijklm' },
  { key: 'n-o', label: 'N-O', letters: 'no' },
  { key: 'p-r', label: 'P-R', letters: 'pqr' },
  { key: 's-z', label: 'S-Z', letters: 'stuvwxyz' },
]

export function matchWeapiDocGroup(method: string, groupKey?: string) {
  if (!groupKey) {
    return true
  }

  const group = WEAPI_DOC_GROUPS.find(item => item.key === groupKey)
  if (!group) {
    return true
  }

  const firstChar = method.trim().charAt(0).toLowerCase()
  return group.letters.includes(firstChar)
}
