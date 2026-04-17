import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { defaultAssetExtensions } from '../../../src/defaults'

async function main() {
  await Promise.all(
    [
      ...[...defaultAssetExtensions, 'fuck', 'shit', 'bitch'].map((x) => {
        return Promise.all(
          [
            fs.outputFile(
              path.resolve(import.meta.dirname, 'src/assets', `index.${x}`),
              '',
              'binary',
            ),
            fs.outputFile(
              path.resolve(import.meta.dirname, 'src/packageB/assets', `index.${x}`),
              '',
              'binary',
            ),
          ],
        )
      }),
    ],
  )
}

main()
