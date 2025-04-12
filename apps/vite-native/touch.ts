// import { touch } from '../../packages/weapp-vite/src/utils/file'
import fs from 'fs-extra'
import path from 'pathe'

function touch(filename: string) {
  const time = new Date()

  try {
    fs.utimesSync(filename, time, time)
  }
  catch {
    fs.closeSync(fs.openSync(filename, 'w'))
  }
}

function r(...args: string[]) {
  return path.resolve(import.meta.dirname, ...args)
}

function t(...args: string[]) {
  touch(r(...args))
}
function main() {
  // t('./app.js')
  // t('./app.json.ts')
  // t('./app.scss')
  t('./custom-tab-bar/index.json')
}

main()
