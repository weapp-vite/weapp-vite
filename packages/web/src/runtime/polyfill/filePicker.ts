import { createTempFilePath } from './mediaPicker'

type ChooseMessageFileType = 'all' | 'video' | 'image' | 'file'

export function normalizeChooseMessageFileCount(count: number | undefined) {
  if (typeof count !== 'number' || Number.isNaN(count)) {
    return 1
  }
  return Math.max(1, Math.floor(count))
}

export function normalizeChooseMessageFileType(type: unknown): ChooseMessageFileType {
  if (type === 'video' || type === 'image' || type === 'file' || type === 'all') {
    return type
  }
  return 'all'
}

function buildChooseMessageAccept(type: ChooseMessageFileType) {
  if (type === 'video') {
    return 'video/*'
  }
  if (type === 'image') {
    return 'image/*'
  }
  if (type === 'file') {
    return '*/*'
  }
  return '*/*'
}

export function normalizeChooseMessageFile(file: {
  size?: number
  type?: string
  name?: string
  lastModified?: number
}) {
  return {
    path: createTempFilePath(file),
    size: typeof file.size === 'number' ? file.size : 0,
    type: typeof file.type === 'string' ? file.type : '',
    name: typeof file.name === 'string' ? file.name : '',
    time: typeof file.lastModified === 'number' ? file.lastModified : Date.now(),
  }
}

async function pickMessageFilesByOpenPicker(count: number, type: ChooseMessageFileType) {
  const picker = (globalThis as {
    showOpenFilePicker?: (options: {
      multiple?: boolean
      types?: Array<{
        description?: string
        accept?: Record<string, string[]>
      }>
    }) => Promise<Array<{ getFile?: () => Promise<any> }>>
  }).showOpenFilePicker
  if (typeof picker !== 'function') {
    return null
  }
  const accept = buildChooseMessageAccept(type)
  const handles = await picker({
    multiple: count > 1,
    types: [{
      description: 'Message Files',
      accept: {
        [accept]: [],
      },
    }],
  })
  const files: any[] = []
  for (const handle of handles ?? []) {
    const file = await handle?.getFile?.()
    if (file) {
      files.push(file)
    }
    if (files.length >= count) {
      break
    }
  }
  return files
}

async function pickMessageFilesByInput(count: number, type: ChooseMessageFileType) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null
  }
  const input = document.createElement('input') as HTMLInputElement
  input.setAttribute('type', 'file')
  input.setAttribute('accept', buildChooseMessageAccept(type))
  if (count > 1) {
    input.setAttribute('multiple', 'true')
  }
  input.setAttribute('style', 'position: fixed; left: -9999px; top: -9999px; opacity: 0;')
  if (document.body) {
    document.body.append(input)
  }
  try {
    const files = await new Promise<any[]>((resolve, reject) => {
      const onChange = () => {
        const selected = input.files ? Array.from(input.files) : []
        if (selected.length) {
          resolve(selected.slice(0, count))
          return
        }
        reject(new Error('no file selected'))
      }
      input.addEventListener('change', onChange, { once: true })
      if (typeof input.click === 'function') {
        input.click()
        return
      }
      reject(new Error('file input click is unavailable'))
    })
    return files
  }
  finally {
    if (input.parentNode) {
      input.parentNode.removeChild(input)
    }
  }
}

export async function pickChooseMessageFiles(count: number, type: ChooseMessageFileType) {
  const viaPicker = await pickMessageFilesByOpenPicker(count, type)
  if (Array.isArray(viaPicker)) {
    return viaPicker
  }
  const viaInput = await pickMessageFilesByInput(count, type)
  if (Array.isArray(viaInput)) {
    return viaInput
  }
  throw new TypeError('Message file picker is unavailable in current environment.')
}

export function normalizeChooseFileExtensions(extension: readonly string[] | undefined) {
  const set = new Set<string>()
  for (const item of extension ?? []) {
    if (typeof item !== 'string') {
      continue
    }
    const normalized = item.trim().toLowerCase()
    if (!normalized) {
      continue
    }
    set.add(normalized.startsWith('.') ? normalized : `.${normalized}`)
  }
  return Array.from(set)
}

function buildChooseFilePickerAccept(type: ChooseMessageFileType, extensions: string[]) {
  if (extensions.length) {
    return {
      '*/*': extensions,
    }
  }
  return {
    [buildChooseMessageAccept(type)]: [],
  }
}

function buildChooseFileInputAccept(type: ChooseMessageFileType, extensions: string[]) {
  if (extensions.length) {
    return extensions.join(',')
  }
  return buildChooseMessageAccept(type)
}

async function pickChooseFileByOpenPicker(
  count: number,
  type: ChooseMessageFileType,
  extensions: string[],
) {
  const picker = (globalThis as {
    showOpenFilePicker?: (options: {
      multiple?: boolean
      types?: Array<{
        description?: string
        accept?: Record<string, string[]>
      }>
    }) => Promise<Array<{ getFile?: () => Promise<any> }>>
  }).showOpenFilePicker
  if (typeof picker !== 'function') {
    return null
  }
  const handles = await picker({
    multiple: count > 1,
    types: [{
      description: 'Files',
      accept: buildChooseFilePickerAccept(type, extensions),
    }],
  })
  const files: any[] = []
  for (const handle of handles ?? []) {
    const file = await handle?.getFile?.()
    if (file) {
      files.push(file)
    }
    if (files.length >= count) {
      break
    }
  }
  return files
}

async function pickChooseFileByInput(
  count: number,
  type: ChooseMessageFileType,
  extensions: string[],
) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null
  }
  const input = document.createElement('input') as HTMLInputElement
  if (!input || typeof input !== 'object') {
    return null
  }
  input.setAttribute('type', 'file')
  input.setAttribute('accept', buildChooseFileInputAccept(type, extensions))
  if (count > 1) {
    input.setAttribute('multiple', 'true')
  }
  input.setAttribute('style', 'position: fixed; left: -9999px; top: -9999px; opacity: 0;')
  if (document.body) {
    document.body.append(input)
  }
  try {
    const files = await new Promise<any[]>((resolve, reject) => {
      const onChange = () => {
        const selected = input.files ? Array.from(input.files) : []
        if (selected.length) {
          resolve(selected.slice(0, count))
          return
        }
        reject(new Error('no file selected'))
      }
      input.addEventListener('change', onChange, { once: true })
      if (typeof input.click === 'function') {
        input.click()
        return
      }
      reject(new Error('file input click is unavailable'))
    })
    return files
  }
  finally {
    if (input.parentNode) {
      input.parentNode.removeChild(input)
    }
  }
}

export async function pickChooseFileFiles(
  count: number,
  type: ChooseMessageFileType,
  extensions: string[],
) {
  const viaPicker = await pickChooseFileByOpenPicker(count, type, extensions)
  if (Array.isArray(viaPicker)) {
    return viaPicker
  }
  const viaInput = await pickChooseFileByInput(count, type, extensions)
  if (Array.isArray(viaInput)) {
    return viaInput
  }
  throw new TypeError('File picker is unavailable in current environment.')
}
