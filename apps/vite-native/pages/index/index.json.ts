import type { Page } from 'weapp-vite/json'
import fs from 'node:fs/promises'
import path from 'node:path'
import xxx from '@/assets/share'
import shared from './shared.json'

console.log(import.meta.env, import.meta.dirname)// , __dirname)
const key = await fs.readFile(path.resolve(import.meta.dirname, 'x.txt'), 'utf8')
console.log(key)
export default <Page>{
  usingComponents: {
    't-button': 'tdesign-miniprogram/button/button',
    't-divider': 'tdesign-miniprogram/divider/divider',
    'ice-avatar': '@/avatar/avatar',
  },
  ...shared,
  ...xxx,
  cccaaa: key,
}
