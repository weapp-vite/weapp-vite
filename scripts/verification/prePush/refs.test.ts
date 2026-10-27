import { expect, it } from 'vitest'
import { parsePushRefs, resolvePushTargets } from './refs.ts'

const old = 'a'.repeat(40)
const head = 'b'.repeat(40)
const zero = '0'.repeat(40)
const tree = 'c'.repeat(40)
const ancestor = 'd'.repeat(40)

it('reads all native refs including branch creation and deletion with CRLF', () => {
  const refs = parsePushRefs(`refs/heads/feature ${head} refs/heads/feature ${zero}\r\n(delete) ${zero} refs/heads/old ${old}\r\n`)
  expect(refs).toHaveLength(2)
  expect(refs[1]).toMatchObject({ localRef: '(delete)', localSha: zero })
  expect(parsePushRefs('')).toEqual([])
})

it.each([
  `refs/heads/a ${head} refs/heads/a`,
  `refs/heads/a ${head} refs/heads/a invalid`,
  `(delete) ${head} refs/heads/a ${old}`,
  `refs/heads/a ${head} refs/heads/a ${old}\nrefs/heads/b ${head} refs/heads/a ${old}`,
])('rejects incomplete or ambiguous native input', input => expect(() => parsePushRefs(input)).toThrow())

it('verifies non-current refs against advertised old commits, including force updates', async () => {
  const commands: string[][] = []
  const targets = await resolvePushTargets(parsePushRefs(`refs/heads/other ${head} refs/heads/other ${old}\n`), async (args) => {
    commands.push(args)
    return args.at(-1) === `${old}^{commit}` ? old : args.at(-1) === `${head}^{tree}` ? tree : head
  })
  expect(targets).toEqual([expect.objectContaining({ head, base: old, tree, localRef: 'refs/heads/other' })])
  expect(commands.some(args => args[0] === 'merge-base')).toBe(false)
})

it('uses the mainline ancestor for new refs and conservatively handles unavailable objects', async () => {
  const refs = parsePushRefs(`refs/heads/new ${head} refs/heads/new ${zero}\nrefs/heads/old ${head} refs/heads/old ${old}\n`)
  const targets = await resolvePushTargets(refs, async (args) => {
    if (args.at(-1) === `${old}^{commit}`) {
      throw new Error('remote object not fetched')
    }
    return args[0] === 'merge-base' ? ancestor : args.at(-1) === `${head}^{tree}` ? tree : head
  })
  expect(targets.map(target => target.base)).toEqual([ancestor, null])
})

it('does not start verification for deleted or unchanged refs', async () => {
  const refs = parsePushRefs(`(delete) ${zero} refs/heads/deleted ${old}\nrefs/heads/same ${head} refs/heads/same ${head}\n`)
  expect(await resolvePushTargets(refs, async () => {
    throw new Error('must not inspect candidate')
  })).toEqual([])
})
