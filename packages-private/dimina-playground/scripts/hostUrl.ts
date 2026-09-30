import { stripVTControlCharacters } from 'node:util'

export function findHostUrl(logs: string) {
  return stripVTControlCharacters(logs).match(/http:\/\/(?:127\.0\.0\.1|localhost):\d+\/dimina\//)?.[0]
}
