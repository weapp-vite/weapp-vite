type ChooseMediaType = 'image' | 'video'

type RawChooseMediaType = ChooseMediaType | 'mix'

export function normalizeChooseImageCount(count: number | undefined) {
  if (typeof count !== 'number' || Number.isNaN(count)) {
    return 9
  }
  return Math.max(1, Math.floor(count))
}

export function createTempFilePath(file: { name?: string }) {
  const runtimeUrl = (globalThis as {
    URL?: {
      createObjectURL?: (value: unknown) => string
    }
  }).URL
  if (runtimeUrl && typeof runtimeUrl.createObjectURL === 'function') {
    const result = runtimeUrl.createObjectURL(file)
    if (result) {
      return result
    }
  }
  return file.name ?? ''
}

export function normalizeChooseImageFile(file: {
  size?: number
  type?: string
  name?: string
}) {
  return {
    path: createTempFilePath(file),
    size: typeof file.size === 'number' ? file.size : 0,
    type: typeof file.type === 'string' ? file.type : '',
    name: typeof file.name === 'string' ? file.name : '',
  }
}

async function pickImageFilesByOpenPicker(count: number) {
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
      description: 'Images',
      accept: {
        'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.avif'],
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

async function pickImageFilesByInput(count: number) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null
  }
  const input = document.createElement('input') as HTMLInputElement
  if (!input || typeof input !== 'object') {
    return null
  }
  input.setAttribute('type', 'file')
  input.setAttribute('accept', 'image/*')
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

export async function pickChooseImageFiles(count: number) {
  const viaPicker = await pickImageFilesByOpenPicker(count)
  if (Array.isArray(viaPicker)) {
    return viaPicker
  }
  const viaInput = await pickImageFilesByInput(count)
  if (Array.isArray(viaInput)) {
    return viaInput
  }
  throw new TypeError('Image picker is unavailable in current environment.')
}

export function normalizeChooseMediaCount(count: number | undefined) {
  if (typeof count !== 'number' || Number.isNaN(count)) {
    return 1
  }
  return Math.max(1, Math.floor(count))
}

export function normalizeChooseMediaTypes(mediaType: RawChooseMediaType[] | undefined) {
  const normalized = new Set<ChooseMediaType>()
  for (const item of mediaType ?? []) {
    if (item === 'image') {
      normalized.add('image')
      continue
    }
    if (item === 'video') {
      normalized.add('video')
      continue
    }
    if (item === 'mix') {
      normalized.add('image')
      normalized.add('video')
    }
  }
  if (normalized.size === 0) {
    normalized.add('image')
    normalized.add('video')
  }
  return normalized
}

function buildChooseMediaOpenPickerAccept(types: Set<ChooseMediaType>) {
  const accept: Record<string, string[]> = {}
  if (types.has('image')) {
    accept['image/*'] = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.avif']
  }
  if (types.has('video')) {
    accept['video/*'] = ['.mp4', '.mov', '.m4v', '.webm']
  }
  return accept
}

function buildChooseMediaInputAccept(types: Set<ChooseMediaType>) {
  if (types.size === 2) {
    return 'image/*,video/*'
  }
  return types.has('video') ? 'video/*' : 'image/*'
}

export function inferChooseMediaFileType(file: { type?: string, name?: string }): ChooseMediaType {
  const mimeType = typeof file.type === 'string' ? file.type.toLowerCase() : ''
  if (mimeType.startsWith('video/')) {
    return 'video'
  }
  if (mimeType.startsWith('image/')) {
    return 'image'
  }
  const fileName = typeof file.name === 'string' ? file.name.toLowerCase() : ''
  if (/\.(?:mp4|mov|m4v|webm)$/i.test(fileName)) {
    return 'video'
  }
  return 'image'
}

export function normalizeChooseMediaFile(file: {
  size?: number
  type?: string
  name?: string
}) {
  const fileType = inferChooseMediaFileType(file)
  return {
    tempFilePath: createTempFilePath(file),
    size: typeof file.size === 'number' ? file.size : 0,
    fileType,
    width: 0,
    height: 0,
    duration: 0,
  }
}

async function pickMediaFilesByOpenPicker(count: number, types: Set<ChooseMediaType>) {
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
      description: 'Media',
      accept: buildChooseMediaOpenPickerAccept(types),
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

async function pickMediaFilesByInput(count: number, types: Set<ChooseMediaType>) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null
  }
  const input = document.createElement('input') as HTMLInputElement
  if (!input || typeof input !== 'object') {
    return null
  }
  input.setAttribute('type', 'file')
  input.setAttribute('accept', buildChooseMediaInputAccept(types))
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

export async function pickChooseMediaFiles(count: number, types: Set<ChooseMediaType>) {
  const viaPicker = await pickMediaFilesByOpenPicker(count, types)
  if (Array.isArray(viaPicker)) {
    return viaPicker
  }
  const viaInput = await pickMediaFilesByInput(count, types)
  if (Array.isArray(viaInput)) {
    return viaInput
  }
  throw new TypeError('Media picker is unavailable in current environment.')
}
