'use strict'

const path = require('node:path')
const fs = require('fs-extra')

if (process.env.WEAPP_VITE_TEST_COPY_RACE_GUARD === '1') {
  const originalCopy = fs.copy.bind(fs)
  const activeDestinations = new Set()

  fs.copy = async function patchedCopy(src, dest, ...rest) {
    const resolvedDest = path.resolve(String(dest))
    if (activeDestinations.has(resolvedDest)) {
      const error = new Error(`detected concurrent fs.copy to "${resolvedDest}"`)
      error.code = 'EWEAPP_COPY_RACE'
      error.syscall = 'copy'
      error.path = resolvedDest
      throw error
    }
    activeDestinations.add(resolvedDest)
    await new Promise(resolve => setTimeout(resolve, 5))
    try {
      return await originalCopy(src, dest, ...rest)
    }
    finally {
      activeDestinations.delete(resolvedDest)
    }
  }
}
