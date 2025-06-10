const identity = (v: string) => v

export const importMetaUrl = identity(import.meta.url)

export const dir = identity(__dirname)

export const file = identity(__filename)
