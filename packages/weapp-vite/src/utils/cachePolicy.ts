export const DEV_PATH_EXISTS_TTL_MS = 250
export const PROD_PATH_EXISTS_TTL_MS = 60_000

export function getPathExistsTtlMs(config?: { isDev?: boolean }) {
  return config?.isDev ? DEV_PATH_EXISTS_TTL_MS : PROD_PATH_EXISTS_TTL_MS
}

export function getReadFileCheckMtime(config?: { isDev?: boolean }) {
  return Boolean(config?.isDev)
}
