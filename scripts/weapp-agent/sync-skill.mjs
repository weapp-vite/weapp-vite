import { cp, mkdir } from 'node:fs/promises'

const target = new URL('../../packages/agent-cli/skills/', import.meta.url)
await mkdir(target, { recursive: true })
await cp(new URL('../../skills/weapp-acceptance', import.meta.url), new URL('weapp-acceptance', target), { recursive: true })
