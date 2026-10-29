/** 加号底部 sheet 的自有文案（中英双语，命名空间 androidComposerSheet）。 */
export const zh = {
  sheetLabel: '添加内容',
  camera: '拍照',
  photo: '照片',
  file: '本地文件',
  more: '更多操作',
  close: '关闭',
}
export const en: typeof zh = {
  sheetLabel: 'Add content',
  camera: 'Camera',
  photo: 'Photos',
  file: 'Local files',
  more: 'More actions',
  close: 'Close',
}
export type ComposerSheetKey = keyof typeof zh
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { androidComposerSheet: ComposerSheetKey }
}
