import path from 'pathe'
import { normalizeRoot, toPosixPath } from '../../../../utils/path'

/**
 * class/style WXS 模块名。
 */
export const CLASS_STYLE_WXS_MODULE = '__weapp_vite'
/**
 * class/style WXS 文件名（不含扩展名）。
 */
export const CLASS_STYLE_WXS_FILE = '__weapp_vite_class_style'

function resolveScriptModuleTag(extension: string) {
  const normalized = extension.startsWith('.') ? extension.slice(1) : extension
  return normalized === 'sjs' ? 'sjs' : 'wxs'
}

/**
 * 构建 class/style WXS 引用标签。
 */
export function buildClassStyleWxsTag(extension: string, src?: string) {
  const normalized = extension.startsWith('.') ? extension.slice(1) : extension
  const resolvedSrc = src ?? `./${CLASS_STYLE_WXS_FILE}.${normalized}`
  const tag = resolveScriptModuleTag(normalized)
  return `<${tag} module="${CLASS_STYLE_WXS_MODULE}" src="${resolvedSrc}"/>`
}

/**
 * 解析 class/style WXS 文件位置与引用路径。
 */
export function resolveClassStyleWxsLocation(options: {
  relativeBase: string
  extension: string
  packageRoot?: string
}) {
  const normalizedExt = options.extension.startsWith('.') ? options.extension.slice(1) : options.extension
  const normalizedRoot = normalizeRoot(options.packageRoot ?? '')
  const fileName = normalizedRoot
    ? `${normalizedRoot}/${CLASS_STYLE_WXS_FILE}.${normalizedExt}`
    : `${CLASS_STYLE_WXS_FILE}.${normalizedExt}`
  const baseDir = path.posix.dirname(toPosixPath(options.relativeBase))
  const fromDir = baseDir === '.' ? '.' : baseDir
  let src = path.posix.relative(fromDir, fileName)
  if (!src || src === '.') {
    src = path.posix.basename(fileName)
  }
  if (!src.startsWith('.') && !src.startsWith('/')) {
    src = `./${src}`
  }
  return { fileName, src }
}

/**
 * 获取内置 class/style WXS 运行时代码。
 */
export function getClassStyleWxsSource() {
  return [
    'var objectCtor = ({}).constructor',
    'var objectProto = objectCtor ? objectCtor.prototype : null',
    'var hasOwn = objectProto ? objectProto.hasOwnProperty : null',
    'var toString = objectProto ? objectProto.toString : null',
    '',
    'function isArray(value) {',
    '  if (!toString) {',
    '    return false',
    '  }',
    '  return toString.call(value) === \'[object Array]\'',
    '}',
    '',
    'function getObjectKeys(obj) {',
    '  if (!objectCtor || !objectCtor.keys) {',
    '    return null',
    '  }',
    '  return objectCtor.keys(obj)',
    '}',
    '',
    'function isWordCharCode(code) {',
    '  return (code >= 48 && code <= 57)',
    '    || (code >= 65 && code <= 90)',
    '    || (code >= 97 && code <= 122)',
    '    || code === 95',
    '}',
    '',
    'function isUpperCaseCode(code) {',
    '  return code >= 65 && code <= 90',
    '}',
    '',
    'function hyphenate(str) {',
    '  if (!str) {',
    '    return \'\'',
    '  }',
    '  if (str.indexOf(\'--\') === 0) {',
    '    return str',
    '  }',
    '  var res = \'\'',
    '  for (var i = 0; i < str.length; i++) {',
    '    var code = str.charCodeAt(i)',
    '    if (isUpperCaseCode(code)) {',
    '      if (i > 0 && isWordCharCode(str.charCodeAt(i - 1))) {',
    '        res += \'-\'',
    '      }',
    '      res += str.charAt(i).toLowerCase()',
    '      continue',
    '    }',
    '    res += str.charAt(i)',
    '  }',
    '  return res',
    '}',
    '',
    'function appendStyle(base, part) {',
    '  if (!part) {',
    '    return base || \'\'',
    '  }',
    '  if (!base) {',
    '    return part',
    '  }',
    '  if (base.charAt(base.length - 1) !== \';\') {',
    '    base += \';\'',
    '  }',
    '  if (part.charAt(0) === \';\') {',
    '    part = part.slice(1)',
    '  }',
    '  return base + part',
    '}',
    '',
    'function stylePair(key, value) {',
    '  if (value == null) {',
    '    return \'\'',
    '  }',
    '  if (isArray(value)) {',
    '    var res = \'\'',
    '    for (var i = 0; i < value.length; i++) {',
    '      var item = value[i]',
    '      if (item == null) {',
    '        continue',
    '      }',
    '      res = appendStyle(res, key + \':\' + item)',
    '    }',
    '    return res',
    '  }',
    '  return key + \':\' + value',
    '}',
    '',
    'function normalizeClass(value) {',
    '  var res = \'\'',
    '  if (!value) {',
    '    return res',
    '  }',
    '  if (typeof value === \'string\') {',
    '    return value',
    '  }',
    '  if (isArray(value)) {',
    '    for (var i = 0; i < value.length; i++) {',
    '      var normalized = normalizeClass(value[i])',
    '      if (normalized) {',
    '        res += normalized + \' \'',
    '      }',
    '    }',
    '    return res.trim()',
    '  }',
    '  if (typeof value === \'object\') {',
    '    var keys = getObjectKeys(value)',
    '    if (!keys) {',
    '      return res',
    '    }',
    '    for (var i = 0; i < keys.length; i++) {',
    '      var key = keys[i]',
    '      if ((!hasOwn || hasOwn.call(value, key)) && value[key]) {',
    '        res += key + \' \'',
    '      }',
    '    }',
    '    return res.trim()',
    '  }',
    '  return res',
    '}',
    '',
    'function stringifyStyle(obj) {',
    '  var res = \'\'',
    '  var keys = getObjectKeys(obj)',
    '  if (!keys) {',
    '    return res',
    '  }',
    '  for (var i = 0; i < keys.length; i++) {',
    '    var key = keys[i]',
    '    if (hasOwn && !hasOwn.call(obj, key)) {',
    '      continue',
    '    }',
    '    var val = obj[key]',
    '    if (val == null) {',
    '      continue',
    '    }',
    '    var name = hyphenate(key)',
    '    if (isArray(val)) {',
    '      for (var j = 0; j < val.length; j++) {',
    '        var item = val[j]',
    '        if (item == null) {',
    '          continue',
    '        }',
    '        res = appendStyle(res, name + \':\' + item)',
    '      }',
    '    }',
    '    else {',
    '      res = appendStyle(res, name + \':\' + val)',
    '    }',
    '  }',
    '  return res',
    '}',
    '',
    'function normalizeStyle(value) {',
    '  if (value == null) {',
    '    return \'\'',
    '  }',
    '  if (typeof value === \'string\') {',
    '    return value',
    '  }',
    '  if (isArray(value)) {',
    '    var res = \'\'',
    '    for (var i = 0; i < value.length; i++) {',
    '      var normalized = normalizeStyle(value[i])',
    '      if (normalized) {',
    '        res = appendStyle(res, normalized)',
    '      }',
    '    }',
    '    return res',
    '  }',
    '  if (typeof value === \'object\') {',
    '    return stringifyStyle(value)',
    '  }',
    '  return \'\'',
    '}',
    '',
    'module.exports = {',
    '  cls: normalizeClass,',
    '  style: normalizeStyle,',
    '  stylePair: stylePair,',
    '}',
    '',
  ].join('\n')
}
