import { transformWxsCode } from '@/wxs'
import fs from 'fs-extra'
import path from 'pathe'

describe('babel', () => {
  it('should 0', async () => {
    const res = await transformWxsCode(`export const foo = "'hello world' from comm.wxs";
export const bar = function (d: string) {
  return d;
}
`)

    if (res) {
      expect(res.code).toMatchSnapshot()
    }
  })

  it('should 1', async () => {
    const res = await transformWxsCode(`export const foo = "'hello world' from comm.wxs";
export const bar = function (d) {
  return d;
}
`)

    if (res) {
      expect(res.code).toMatchSnapshot()
    }
  })

  it('should 2', async () => {
    const res = await transformWxsCode(`export function aa() {
  return new RegExp('{|}|"', 'g')
}
`)

    if (res) {
      expect(res.code).toMatchSnapshot()
    }
  })

  it('should 3', async () => {
    const res = await transformWxsCode(`export function bb() {
  return /{|}|"/g
}
`)

    if (res) {
      expect(res.code).toMatchSnapshot()
    }
  })

  it('should 4', async () => {
    const res = await transformWxsCode(`export function bb() {
  return /{|}|"/
}
`)

    if (res) {
      expect(res.code).toMatchSnapshot()
    }
  })

  it('should 5', async () => {
    const res = await transformWxsCode(`export function aa() {
  return new RegExp('{|}|"')
}
`)

    if (res) {
      expect(res.code).toMatchSnapshot()
    }
  })

  it('should 6', async () => {
    const res = await transformWxsCode(`export function aa() {
  return new Date()
}
`)

    if (res) {
      expect(res.code).toMatchSnapshot()
    }
  })

  it('should 7', async () => {
    const res = await transformWxsCode(
      await fs.readFile(
        path.resolve(__dirname, '../fixtures/wxs/utis.wxs.ts'),
        {
          encoding: 'utf8',
        },
      ),
    )

    if (res) {
      expect(res.code).toMatchSnapshot()
    }
  })

  it('should 8', async () => {
    const res = await transformWxsCode(
      await fs.readFile(
        path.resolve(__dirname, '../fixtures/wxs/row.wxs.ts'),
        {
          encoding: 'utf8',
        },
      ),
    )

    if (res) {
      expect(res.code).toMatchSnapshot()
    }
  })
})
