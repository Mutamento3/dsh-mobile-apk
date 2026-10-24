#!/usr/bin/env node
// check-i18n-parity.mjs — 中英文案一致性门禁（0.15.0）。
//
// 背景：AGENTS.md 要求「新增或改写自定义界面必须中英双语文案」，但此前**没有任何机器校验**：
//  - app/src/main/res/values/strings.xml 与 values-en/strings.xml 的键集合是否一致，只靠人工比对；
//    漏一条英文，英文界面就退回中文（Android 的资源回退是静默的，构建、单测、CI 全绿）；
//  - dsh-client-ui-responsive 里的 tr('中文', 'English') 若漏写第二个参数或写成空串，
//    英文界面会直接显示中文，同样静默。
//
// 本门禁把这两件事变成可判红的静态检查，不依赖 Android 构建（纯文本解析）：
//  A. 资源层：values/ 与 values-en/ 的 string 键集合必须一致（按 translatable 过滤）；
//  B. 代码层：dsh-client-ui-responsive/src 下每个 tr(...) 必须带两个非空字符串参数。
//
// 用法：node scripts/check-i18n-parity.mjs [--root <仓库根>] [--self-test]
// 退出码：0 = 通过；1 = 命中不一致；2 = 根定位失败。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = dirname(HERE)
const argv = process.argv.slice(2)
const argOf = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? (argv[i + 1] ?? d) : d }
const SELF_TEST = argv.includes('--self-test')

/** 解析 Android strings XML，返回 name -> 文本（跳过 translatable="false"）。 */
export function parseStringsXml(text) {
  const out = new Map()
  const re = /<string\b([^>]*)>([\s\S]*?)<\/string>/g
  let m
  while ((m = re.exec(text)) !== null) {
    const attrs = m[1]
    if (/\btranslatable\s*=\s*"false"/.test(attrs)) continue
    const name = /\bname\s*=\s*"([^"]+)"/.exec(attrs)?.[1]
    if (name !== undefined) out.set(name, m[2])
  }
  return out
}

/** 比较两个键集合，返回 {missing, extra}。 */
export function compareKeys(zh, en) {
  const zhKeys = new Set(zh.keys())
  const enKeys = new Set(en.keys())
  return {
    missing: [...zhKeys].filter((k) => !enKeys.has(k)).sort(),
    extra: [...enKeys].filter((k) => !zhKeys.has(k)).sort(),
  }
}

/**
 * 扫描一段 TS/TSX，返回「tr 调用缺英文」的位置。
 *
 * 不能用正则直接匹配 `tr('中文')`：真实调用经常跨行、参数里还有拼接与嵌套调用
 * （例如 tr('检查 ' + count('checked') + ' 项', count('checked') + ' checked')），
 * 惰性正则会从第一个引号一路吃到后面的引号，把合法双语文案误判成单参数。
 * 这里按括号配对 + 字符串状态扫描，再按顶层逗号切参数。
 */
export function scanTrCalls(text) {
  const hits = []
  const isTrAt = (i) => {
    if (text.slice(i, i + 3) !== 'tr(') return false
    const prev = i === 0 ? '' : text[i - 1]
    return !/[A-Za-z0-9_$.]/.test(prev)
  }
  for (let i = 0; i < text.length; i++) {
    if (!isTrAt(i)) continue
    const open = i + 2
    let depth = 0
    let quote = null
    let args = 1
    let end = -1
    // 从 '(' 之后开始扫：open 本身是调用括号，不能计入嵌套深度。
    for (let j = open + 1; j < text.length; j++) {
      const c = text[j]
      if (quote !== null) {
        if (c === '\\') { j++; continue }
        if (c === quote) quote = null
        continue
      }
      if (c === "'" || c === '"' || c === '`') { quote = c; continue }
      if (c === '(' || c === '[' || c === '{') { depth++; continue }
      if (c === ')' || c === ']' || c === '}') {
        if (depth === 0) { end = j; break }
        depth--
        continue
      }
      if (c === ',' && depth === 0) args++
    }
    if (end < 0) continue
    const line = text.slice(0, i).split('\n').length
    const body = text.slice(open + 1, end)
    if (args < 2) hits.push({ line, zhText: body.trim().slice(0, 24), reason: 'single-arg' })
    else {
      // 第二个顶层参数若是空字符串字面量，也算缺英文
      const second = splitTopLevel(body, ',')[1] ?? ''
      if (/^\s*(['"])\s*\1\s*$/.test(second)) hits.push({ line, zhText: body.trim().slice(0, 24), reason: 'empty-en' })
    }
  }
  return hits
}

/** 按顶层逗号切分（忽略字符串与括号内的逗号）。 */
function splitTopLevel(body, sep) {
  const out = []
  let depth = 0
  let quote = null
  let cur = ''
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (quote !== null) {
      cur += c
      if (c === '\\') { cur += body[++i] ?? ''; continue }
      if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; cur += c; continue }
    if (c === '(' || c === '[' || c === '{') depth++
    if (c === ')' || c === ']' || c === '}') depth--
    if (c === sep && depth === 0) { out.push(cur); cur = ''; continue }
    cur += c
  }
  out.push(cur)
  return out
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

function selfTest() {
  const failures = []
  const zh = parseStringsXml('<resources><string name="a">甲</string><string name="b" translatable="false">B</string></resources>')
  const en = parseStringsXml('<resources><string name="a">A</string></resources>')
  const diff = compareKeys(zh, en)
  if (diff.missing.length !== 0) failures.push('可翻译键应视为成对（translatable=false 必须被忽略）')
  if (zh.size !== 1) failures.push('translatable=false 的键不应进入集合')
  const gap = compareKeys(new Map([['x', '甲'], ['y', '乙']]), new Map([['x', 'X']]))
  if (gap.missing.join(',') !== 'y') failures.push('缺英文的键必须被检出')
  const extra = compareKeys(new Map([['x', '甲']]), new Map([['x', 'X'], ['z', 'Z']]))
  if (extra.extra.join(',') !== 'z') failures.push('多出的英文键必须被检出')
  const single = scanTrCalls("tr('中文')\ntr('中文', 'English')")
  if (single.length !== 1 || single[0].reason !== 'single-arg') failures.push('单参数 tr 必须被检出')
  const empty = scanTrCalls("tr('中文', '')")
  if (empty.length !== 1 || empty[0].reason !== 'empty-en') failures.push('空英文 tr 必须被检出')
  const clean = scanTrCalls("tr('中文', 'English')")
  if (clean.length !== 0) failures.push('双语文案不得误报')
  if (failures.length > 0) {
    for (const f of failures) console.error('  FAIL ' + f)
    console.error('CHECK-I18N-PARITY SELF-TEST FAILED（' + failures.length + ' 项）')
    return 1
  }
  console.log('CHECK-I18N-PARITY SELF-TEST PASSED（6 条判据：可翻译成对 / 忽略不可翻译 / 缺键检出 / 多键检出 / 单参检出 / 空英文检出 / 无误报）')
  return 0
}

function main() {
  if (SELF_TEST) return selfTest()

  const rootArg = argOf('root', null)
  const root = rootArg !== null ? rootArg : ROOT
  const resDir = join(root, 'app/src/main/res')
  if (!existsSync(resDir)) {
    console.error('CHECK-I18N-PARITY FAILED：找不到 ' + resDir + '（用 --root 指定仓库根）')
    return 2
  }

  const problems = []

  // A. 资源层：values/ 与 values-en/ 键集合一致
  const zhDir = join(resDir, 'values')
  const enDir = join(resDir, 'values-en')
  const zhFiles = existsSync(zhDir) ? readdirSync(zhDir).filter((f) => f.endsWith('.xml')) : []
  for (const file of zhFiles) {
    const zhPath = join(zhDir, file)
    const enPath = join(enDir, file)
    const zh = parseStringsXml(readFileSync(zhPath, 'utf8'))
    if (zh.size === 0) continue
    if (!existsSync(enPath)) {
      problems.push('资源缺英文文件：values/' + file + '（含 ' + zh.size + ' 条可翻译文案）')
      continue
    }
    const diff = compareKeys(zh, parseStringsXml(readFileSync(enPath, 'utf8')))
    for (const k of diff.missing) problems.push('资源缺英文：values-en/' + file + ' 缺 ' + k)
    for (const k of diff.extra) problems.push('资源多英文：values-en/' + file + ' 有 ' + k + '，values/ 没有')
  }

  // B. 代码层：tr() 必须带两个非空参数
  const uiDir = join(root, 'dsh-client-ui-responsive/src')
  for (const file of walk(uiDir)) {
    const text = readFileSync(file, 'utf8')
    for (const hit of scanTrCalls(text)) {
      const rel = file.slice(root.length + 1)
      problems.push('文案缺英文：' + rel + ':' + hit.line + '（' + hit.reason + '：' + hit.zhText.slice(0, 24) + '）')
    }
  }

  if (problems.length > 0) {
    for (const p of problems) console.log('  - ' + p)
    console.error('CHECK-I18N-PARITY FAILED（' + problems.length + ' 项）')
    return 1
  }
  console.log('CHECK-I18N-PARITY PASSED（资源键集合成对；tr 调用均为双语文案）')
  return 0
}

process.exit(main())
