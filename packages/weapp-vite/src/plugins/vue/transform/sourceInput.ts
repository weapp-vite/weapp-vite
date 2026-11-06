import type { CompilerContext } from '../../../context'
import { transformUniAppCompatibilitySource } from '../../uniApp'
import { readCompilerInput } from '../../utils/sourceSnapshot'

/** 直接编译 SFC 时先读取本批冻结输入，再应用与普通 transform 相同的条件编译。 */
export async function readVueLikeCompilerInput(
  configService: NonNullable<CompilerContext['configService']>,
  filename: string,
  read?: (filename: string) => Promise<string>,
  blockType?: 'script' | 'style' | 'template',
) {
  const rawSource = await readCompilerInput(configService, filename, read)
  return {
    rawSource,
    source: transformUniAppCompatibilitySource(configService, rawSource, filename, blockType),
  }
}
