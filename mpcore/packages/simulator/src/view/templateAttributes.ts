import { sourceAttributeForms } from './sharedDocument'

/** 裸属性词法信息属于节点，普通展开和渲染克隆保留同一份只读元数据。 */
export function isValuelessTemplateAttribute(node: object, name: string) {
  return sourceAttributeForms(node)?.has(name) ?? false
}

export function copyTemplateAttributeMetadata(source: object, target: object) {
  const attributes = sourceAttributeForms(source)
  const destination = target as { attributeForms?: ReadonlySet<string> }
  if (attributes) {
    destination.attributeForms = attributes
  }
  else {
    delete destination.attributeForms
  }
}
