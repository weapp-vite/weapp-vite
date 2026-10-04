import { readdir } from 'node:fs/promises'
import path from 'node:path'

/** 显式选择单个实验绑定；目录形式便于三平台使用同一命令，不依赖 shell 通配符。 */
export async function analysisOptions(arguments_: string[]) {
  const options = new Map<string, string>()
  for (const argument of arguments_) {
    const match = /^--(binding|binding-dir|output)=(.+)$/.exec(argument)
    if (!match || options.has(match[1]!)) {
      throw new Error('Expected --binding=<experimental .node> or --binding-dir=<directory>, and --output=<new directory>')
    }
    options.set(match[1]!, match[2]!)
  }
  if (!options.has('output') || options.has('binding') === options.has('binding-dir')) {
    throw new Error('Exactly one explicit binding source and an output directory are required')
  }
  let binding = options.get('binding')
  if (!binding) {
    const directory = options.get('binding-dir')!
    const files = (await readdir(directory, { withFileTypes: true })).filter(file => file.isFile() && file.name.endsWith('.node'))
    if (files.length !== 1) {
      throw new Error('Expected exactly one experimental .node binding')
    }
    binding = path.join(directory, files[0]!.name)
  }
  if (path.extname(binding) !== '.node') {
    throw new Error('Experimental binding must be a .node file')
  }
  return { binding: path.resolve(binding), output: path.resolve(options.get('output')!) }
}
