import { defaultAssetExtensions } from '../../../src/defaults'
import path from 'pathe'
import fs from 'fs-extra'

async function main() {
  await Promise.all(
    [
      ...[...defaultAssetExtensions, 'fuck', 'shit', 'bitch'].map(x => {
        return Promise.all(
          [
            fs.outputFile(
              path.resolve(import.meta.dirname, 'src/assets', 'index.' + x),
              '',
              'binary'
            ),
            fs.outputFile(
              path.resolve(import.meta.dirname, 'src/packageB/assets', 'index.' + x),
              '',
              'binary'
            )
          ]
        )
      }),
    ]
  )
}

main()