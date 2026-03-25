import { twMerge } from 'tailwind-merge'

type ClassValue
  = string
    | number
    | null
    | undefined
    | false
    | ClassValue[]
    | Record<string, boolean | null | undefined>

function flattenClassValue(input: ClassValue, tokens: string[]) {
  if (!input) {
    return
  }

  if (Array.isArray(input)) {
    for (const value of input) {
      flattenClassValue(value, tokens)
    }
    return
  }

  if (typeof input === 'object') {
    for (const [key, enabled] of Object.entries(input)) {
      if (enabled) {
        tokens.push(key)
      }
    }
    return
  }

  tokens.push(String(input))
}

export function cn(...inputs: ClassValue[]) {
  const tokens: string[] = []

  for (const input of inputs) {
    flattenClassValue(input, tokens)
  }

  return twMerge(tokens.join(' '))
}
