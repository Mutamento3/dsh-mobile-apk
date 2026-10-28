#!/usr/bin/env node
// check-code-map.mjs — 执行地图（EXECUTION-MAP.md）覆盖与锚点门禁。
//
// 目的：把「代码执行地图」变成**不会静默过期**的资产。地图文档是人写的说明面，
// 最容易的失效方式是「新加了一个源文件，没人把它挂到任何查点上」——此后排查的人
// 按图索骥永远找不到它。本门禁守四件事：
//   1. 覆盖：app/src、plugins/*/{src,test}、三个子仓 src、构建与门禁脚本 —— 每个文件
//      至少被覆盖账本（<!-- COVERAGE --> 块）里的一条路径或 glob 命中；
//   2. Anchors must resolve within the source file. Legacy coordinates are pinned to source-line
//      snapshots, while new or moved coordinates require `#expect=` content;
//   3. 编号：主表（<!-- TABLE-ROW --> 块）里的查点 ID 与 `### <ID>` 章节必须一一对应；
//      耦合边（<!-- COUPLING --> 块）两端的 ID 必须都已登记；
//   4. 排版：mermaid 围栏成对、块内不得出现 style/classDef/linkStyle（渲染兼容），
//      文档不得含 emoji（仓铁律）。
//
// 用法：
//   node scripts/check-code-map.mjs                 # 校验（默认文档 docs/AGENTS/EXECUTION-MAP.md）
//   node scripts/check-code-map.mjs --list          # 只打印账本盘点，不判红
//   node scripts/check-code-map.mjs --doc <path>    # 换文档（调试用）
//   node scripts/check-code-map.mjs --self-test     # 无仓库依赖的判别力自检（含故意失败样本）
//   node scripts/check-code-map.mjs --refresh-anchor-baseline # Refresh reviewed legacy anchor snapshots
// 退出码：0 = 通过；1 = 有失败项；2 = 前置不满足（文档缺失/文档缺账本块）。
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

const HERE = dirname(fileURLToPath(import.meta.url))
/**
 * 仓根定位（布局无关）。本门禁的输入全部在 **apk 仓**（app/src、plugins、EXECUTION-MAP.md）。
 * 两种布局都必须能跑，因为门禁会被从两个根调用：
 *   - apk 自包含根：脚本在 `<apk>/scripts/` ⇒ HERE 的父目录就是 apk 仓；
 *   - 协调仓根：脚本镜像在 `<coord>/scripts/`，apk 树在 `<coord>/dsh-mobile-apk/`。
 * 旧实现直接取 dirname(HERE) 当基线仓，于是从协调仓根跑时把**协调仓**当基线：
 * 全域文件 0、覆盖账本 967 项全判「路径不存在」而失败（exit 2）。而构建链恰好是从
 * 协调仓根逐条调用门禁的，所以这条布局缺口会让本门禁永远进不了声明集。
 */
const SELF = dirname(HERE)
const looksLikeApkRepo = (p) => existsSync(join(p, 'app', 'src', 'main', 'AndroidManifest.xml'))
const REPO = looksLikeApkRepo(SELF)
  ? SELF
  : (looksLikeApkRepo(join(SELF, 'dsh-mobile-apk')) ? join(SELF, 'dsh-mobile-apk') : SELF)
const PARENT = dirname(REPO)
const argv = process.argv.slice(2)
const argOf = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? (argv[i + 1] ?? d) : d }
const DOC_REL = argOf('doc', 'docs/AGENTS/EXECUTION-MAP.md')
const LIST_ONLY = argv.includes('--list')
const SELF_TEST = argv.includes('--self-test')
const REFRESH_ANCHOR_BASELINE = argv.includes('--refresh-anchor-baseline')
const DERIVE_ANCHORS = argv.includes('--derive-anchors')
const DERIVE_DRY_RUN = argv.includes('--derive-dry-run')
/** CI 等价性检查：apk 仓在被独立检出时没有协调仓父目录，--no-parent 用来本地预演那种情形。 */
const NO_PARENT = argv.includes('--no-parent')
const ANCHOR_BASELINE_REL = 'scripts/check-code-map-anchor-baseline.json'
const ANCHOR_BASELINE_ABS = join(REPO, ANCHOR_BASELINE_REL)
const ANCHOR_BASELINE = existsSync(ANCHOR_BASELINE_ABS)
  ? JSON.parse(readFileSync(ANCHOR_BASELINE_ABS, 'utf8'))
  : {}

/** 覆盖全域：地图必须能定位到的文件集合（构建产物与第三方目录除外）。 */
const UNIVERSE = [
  { root: 'app/src', keep: (p) => p === 'main/AndroidManifest.xml' || p.endsWith('.kt') },
  { root: 'plugins', keep: (p) => /^[^/]+\/(src|test)\/[^/]+/.test(p) && /\.(ts|tsx|mjs|js)$/.test(p) },
  { root: 'dsh-client-ui-responsive/src', keep: (p) => /\.(ts|tsx|css)$/.test(p) },
  { root: 'dsh-host-web-compat/lib', keep: (p) => /\.(js|ts|d\.ts)$/.test(p) },
  { root: 'dsh-host-web-compat/scripts', keep: (p) => /\.(mjs|js)$/.test(p) },
  { root: 'dsh-shell-termux/src', keep: (p) => /\.ts$/.test(p) },
  {
    root: 'scripts',
    keep: (p) => !p.includes('/') && /\.(mjs|ps1|py|sh)$/.test(p)
      && /^(check-|verify-|build-|inject-|make-snapshot|relocate-snapshot|update-snapshot-patch)/.test(p),
  },
  { root: 'scripts/patches', keep: (p) => /\.(mjs|js)$/.test(p) },
  { root: 'scripts/snapshot-config', keep: () => true },
]
const SKIP_DIRS = new Set(['node_modules', '.git', 'build', 'out', 'release', '.gradle', '__pycache__', '.deploy-tmp'])

/** glob → 正则：支持 `**`（跨目录）、`*`（单层内）、`?`；路径一律 `/` 分隔且相对仓根。 */
export function globToRegExp(pattern) {
  let re = ''
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i]
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        i += 1
        if (pattern[i + 1] === '/') { i += 1; re += '(?:.*/)?' } else { re += '.*' }
      } else re += '[^/]*'
    } else if (c === '?') re += '[^/]'
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp('^' + re + '$')
}

const norm = (p) => p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^dsh-mobile-apk\//, '')

const ID_SHAPE = /^[A-Za-z]{1,3}\d{1,3}$/

/** 锚点与耦合证据共用的扩展名口径（避免两处漂移）。
 *  写法纪律：这里刻意不用 `\w`/`\d`/`\.`（字符串字面量里的反斜杠转义在落盘/传输环节
 *  有过被吞成单字符的实锤，正则静默失效）——一律用等价的显式字符类。 */
const EXT = 'kt|kts|ts|tsx|mjs|js|py|ps1|sh|json|xml|yml|yaml|md'
const PATH_GROUP = '((?:[A-Za-z0-9_.@-]+/)*[A-Za-z0-9_.@-]+[.](?:' + EXT + '))'
const LINE_GROUP = ':([0-9]+)'
const RANGE_GROUP = '(?:-[0-9]+)?'
const EXPECT_GROUP = '(?:#expect=([^`\\n]*))?'
// 符号锚点：`path#Symbol` / `path#Class.method`（或 `Class::method`）/ 带内容哈希 `path#Symbol@<sha8>` /
// 带行号提示 `path#Symbol#<行号>`。行号只作缓存，不当判据。
// 排除 `#L1499-L1634` 这类既有的行号范围引用（L 后紧跟数字），以及 CSS 颜色字面量。
const SYMBOL_GROUP = '#((?!L[0-9])[A-Za-z_][A-Za-z0-9_$]*(?:(?:[.]|::)[A-Za-z_$][A-Za-z0-9_$]*)*)(?![A-Za-z0-9_$.-])'
// 内容哈希：@<4..16 位十六进制>。给「从 legacy 推导出来」的符号锚点用——
// 它把判据锚在推导当时的**那一行内容**的哈希上，而不是整段符号体，
// 这样同文件其它符号改动不会误伤它。
const SYMBOL_HASH_GROUP = '(?:@([0-9a-f]{4,16}))?'
const SYMBOL_HINT_GROUP = '(?:#([0-9]+))?'
const ANCHOR_RE = new RegExp('(?:^|[^A-Za-z0-9_./:@-])' + PATH_GROUP + LINE_GROUP + RANGE_GROUP + EXPECT_GROUP
  + '|(?:^|[^A-Za-z0-9_./:@-])' + PATH_GROUP + SYMBOL_GROUP + SYMBOL_HASH_GROUP + SYMBOL_HINT_GROUP, 'g')
const EVIDENCE_RE = new RegExp(PATH_GROUP + LINE_GROUP + RANGE_GROUP + EXPECT_GROUP)

function parseExpectation(raw) {
  if (raw === undefined) return { expect: undefined }
  try {
    const expect = decodeURIComponent(raw.trim())
    return expect ? { expect } : { expectError: 'expected fragment is empty' }
  } catch {
    return { expectError: 'expected fragment is not valid URI encoding' }
  }
}

/**
 * 从源码里定位符号的定义行与**归一化后的符号体**。
 *
 * 为什么改成符号锚定（2026-10-28 用户裁定，方案 B）：旧锚点是「行号 + 期望内容字面量」，
 * 任何一次合并只要在这些文件里插了几行，整批锚点立刻集体漂移——实测 #718 / #771 / #788
 * 三次合并各把 main 判红一次，每次都要人工重铺基线。符号锚点把判据换成
 * 「符号在不在、符号体变没变」，行号只当缓存：符号存在而行号变了 = 自动重算，**不算 drift**。
 *
 * 支持：顶层 fun/class/object/interface/val/const/function/def，嵌套成员用点号（Foo.bar）。
 * 归一化：逐行 trim、丢空行、连续空白压成一个空格——使纯排版改动不改变符号体。
 * 不做完整 AST 解析：本仓三种语言 x 两种布局，成本远大于收益；「定义行 + 配对花括号」
 * 足够稳，且误报方向是判红（保守）。
 */
/**
 * 找出文件里 `name` 的**定义位置**（行下标，0-based）。
 *
 * 为什么单独做：不同语言的定义形态不同——
 *   - Kotlin：`fun name(` / `val name`（一定有关键字）
 *   - TS 顶层：`export function name(` / `const name = `
 *   - TS 类方法：`name(args) {`（**没有关键字**）
 * 只用「关键字 + 名字」会把 TS 类方法漏掉，导致同名判定偏少、消歧失效
 * （实测：两个类各有 parseDoc 方法时数出 0 处定义，锚点被错绑到诱饵上）。
 *
 * 判定口径：
 *   ① 行首（允许修饰符）出现 `fun|class|object|interface|val|var|let|function|type|def|struct|enum|const` + name
 *   ② 或行首直接是 `name` 紧跟 `( < = :`（TS 类方法 / 注解式声明）
 * 两种情况都排除后面还接着标识符字符的（`nameExtra` 不算命中）。
 */
function definitionSitesOf(lines, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const withKeyword = new RegExp(
    '^\\s*(?:(?:private|public|internal|protected|export|default|override|suspend|inline|operator|abstract|open|final|static|async|const|data|sealed|enum|lateinit|readonly)\\s+)*'
    + '(?:fun|class|object|interface|val|var|let|function|type|def|struct|enum)\\s+'
    + esc + '(?![A-Za-z0-9_$])',
  )
  const bareMember = new RegExp('^\\s*(?:(?:public|private|protected|static|async|readonly)\\s+)*' + esc + '\\s*[<(=:]')
  const sites = []
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i]
    if (withKeyword.test(t) || bareMember.test(t)) sites.push(i)
  }
  return sites
}

function symbolAt(lines, symbol) {
  const parts = symbol.split('.')
  const findIn = (fromLine, toLine, name) => {
    const re = new RegExp(
      '(?:^|[^A-Za-z0-9_$])'
      + '(?:(?:private|public|internal|protected|export|default|override|suspend|inline|operator|abstract|open|final|static|async|const|data|sealed|enum)[ ]+)*'
      + '((?:fun|class|object|interface|val|var|let|function|type|def)[ ]+)?'
      + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      + '(?![A-Za-z0-9_$])',
    )
    for (let i = fromLine; i < toLine; i += 1) if (re.test(lines[i])) return i
    return -1
  }
  const start = findIn(0, lines.length, parts[0])
  if (start < 0) return { found: false }

  // 用户决定 2：同名多符号必须消歧（`Class.method`），不得猜。
  // 用共享的 definitionSitesOf——它同时认「带关键字」和「TS 类方法」两种定义形态。
  // 只数定义行，不数调用点。
  if (parts.length === 1) {
    const defSites = definitionSitesOf(lines, parts[0])
    if (defSites.length > 1) {
      return { found: false, ambiguous: true, count: defSites.length, sites: defSites.slice(0, 5).map((i) => i + 1) }
    }
    return { found: true, line: start + 1, body: normalizedSymbolBody(lines, start) }
  }
  let cur = start
  let curEnd = matchingBrace(lines, start)
  if (curEnd < 0) return { found: false }
  for (let k = 1; k < parts.length; k += 1) {
    const idx = findIn(cur + 1, curEnd, parts[k])
    if (idx < 0) return { found: false }
    if (k === parts.length - 1) return { found: true, line: idx + 1, body: normalizedSymbolBody(lines, idx) }
    const close = matchingBrace(lines, idx)
    if (close < 0) return { found: false }
    cur = idx
    curEnd = close
  }
  return { found: false }
}

/** 从 startLine 起找配对花括号的结束行下标（0-based）；无花括号时退化为「到空行为止」。 */
function matchingBrace(lines, startLine) {
  let depth = 0
  let opened = false
  for (let i = startLine; i < lines.length; i += 1) {
    for (const ch of lines[i]) {
      if (ch === '{') { depth += 1; opened = true } else if (ch === '}') { depth -= 1; if (opened && depth === 0) return i }
    }
    if (!opened && i > startLine && lines[i].trim() === '') return i - 1
  }
  return opened ? -1 : Math.min(startLine, lines.length - 1)
}

/** 符号体归一化：逐行 trim、丢空行、连续空白压成一个空格。 */
function normalizedSymbolBody(lines, startLine) {
  const end = matchingBrace(lines, startLine)
  const stop = end < 0 ? lines.length - 1 : end
  const out = []
  for (let i = startLine; i <= stop; i += 1) {
    const t = lines[i].replace(/\s+/g, ' ').trim()
    if (t !== '') out.push(t)
  }
  return out.join('\n')
}

/** 已有符号基线（符号 -> 归一化符号体）。refresh 时在其上逐条更新，不清掉未出现的条目。 */
function anchorBaselineSymbols() {
  return (ANCHOR_BASELINE && ANCHOR_BASELINE.symbols) || {}
}

/**
 * 把一条 legacy 锚点（path:line + 该行内容）**推导**成符号锚点。
 *
 * 用户决定 1（2026-10-28）：存量 1113 条 legacy 锚点不能靠手改，要能自动推导成可自愈的形式。
 *
 * 推导规则：
 *  1. 从 line 向上扫，找到最近的**符号定义行**（顶层或类成员级的 fun/class/object/val/...）。
 *     这就是「包围该行的符号」。
 *  2. 若该符号在同文件内**唯一** ⇒ 输出 `#Symbol@<内容哈希>`。
 *  3. 若同名符号有多个（重载 / 不同类里的同名方法）⇒ 必须消歧：
 *     用 `#Class.method`；推不出类名 ⇒ **判红，不猜**（用户决定 2）。
 *  4. 若向上扫不到符号（顶层语句 / 配置文件 / YAML / JSON）⇒ 退化为「全文唯一内容匹配」：
 *     该行内容在文件里唯一出现 ⇒ 输出 `#<内容哈希>` 形式的**内容锚点**；
 *     不唯一 ⇒ 保持 legacy，并在 dry-run 报告里列出（用户决定 1：不要猜）。
 *
 * 返回 { ok: true, symbol, hash, line } 或 { ok: false, reason }。
 */
function deriveSymbolAnchor(lines, line, contentHash) {
  const defRe = /^\s*(?:(?:private|public|internal|protected|export|default|override|suspend|inline|operator|abstract|open|final|static|async|const|data|sealed|enum|lateinit)\s+)*(?:fun|class|object|interface|val|var|let|function|type|def|struct|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/
  const classRe = /^\s*(?:(?:private|public|internal|protected|export|default|abstract|open|final|data|sealed|enum|static)\s+)*(?:class|object|interface)\s+([A-Za-z_$][A-Za-z0-9_$]*)/
  const idx = Math.min(Math.max(line - 1, 0), lines.length - 1)

  // 1) 向上找包围符号；同时按**花括号深度**判定宿主类（消歧用）。
  //
  // 关键：不能只「向上扫到第一个 class 就算宿主」——目标行可能在一个函数的局部作用域里，
  // 向上先遇到的 class 可能是更外层的兄弟类。正确做法是跟着花括号深度走：
  // 从目标行向上扫，depth 累加 '}' 减去 '{'；某个 class 声明行的**结束位置**（配对的 '}'）
  // 必须覆盖目标行才是真正的宿主。
  const enclosingClasses = []
  for (let i = 0; i < idx; i += 1) {
    const cm = lines[i].match(classRe)
    if (!cm) continue
    const close = matchingBrace(lines, i)
    if (close >= idx) enclosingClasses.push({ name: cm[1], start: i, close })
  }
  // 最内层（start 最大）就是宿主类
  const ownerClass = enclosingClasses.length > 0
    ? enclosingClasses[enclosingClasses.length - 1].name
    : null

  let symbol = null
  let symbolLine = -1
  for (let i = idx; i >= 0; i -= 1) {
    const dm = lines[i].match(defRe)
    if (dm) { symbol = dm[1]; symbolLine = i; break }
  }
  if (symbol === null) {
    // 4) 退化为全文唯一内容匹配
    const target = lines[idx].trim()
    if (target === '') return { ok: false, reason: '该行为空行，无法推导' }
    const hits = []
    for (let i = 0; i < lines.length; i += 1) if (lines[i].trim() === target) hits.push(i)
    if (hits.length !== 1) return { ok: false, reason: '内容在全文出现 ' + hits.length + ' 次，不唯一' }
    return { ok: true, symbol: null, hash: contentHash, line: idx + 1, kind: 'content' }
  }

  // 2) 同名符号是否唯一
  const nameRe = new RegExp('(?:^|[^A-Za-z0-9_$])' + symbol.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9_$])')
  let sameName = 0
  for (const l of lines) if (defRe.test(l) && nameRe.test(l)) sameName += 1

  if (sameName === 1) {
    return { ok: true, symbol, hash: contentHash, line: symbolLine + 1, kind: 'symbol' }
  }
  // 3) 需要消歧
  if (ownerClass === null || ownerClass === symbol) {
    return { ok: false, reason: '同名符号 ' + sameName + ' 处且推导不出宿主类名，需人工消歧' }
  }
  return { ok: true, symbol: ownerClass + '.' + symbol, hash: contentHash, line: symbolLine + 1, kind: 'disambiguated' }
}

/** 行内容的短哈希（sha256 前 8 位），用于 `@hash` 判据。 */
function contentHashOf(text) {
  return createHash('sha256').update(text.trim()).digest('hex').slice(0, 8)
}

function countLegacyReferences(anchors) {
  const counts = {}
  for (const anchor of anchors) {
    if (anchor.symbolForm) continue
    if (anchor.expect !== undefined || anchor.expectError !== undefined) continue
    const key = anchor.path + ':' + anchor.line
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

function increasedLegacyReferences(anchors, baselineCounts) {
  return Object.entries(countLegacyReferences(anchors))
    .filter(([key, count]) => count > (baselineCounts[key] ?? 0))
}

/** 按 `## <序号>. <标题前缀>` 切出章节正文（可见表格按章节解析，注释块作为兼容来源）。 */
export function sectionOf(text, titlePrefix) {
  const lines = text.split('\n')
  let start = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i]) && lines[i].replace(/^##\s+/, '').startsWith(titlePrefix)) { start = i + 1; break }
  }
  if (start < 0) return ''
  const out = []
  for (let i = start; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) break
    out.push(lines[i])
  }
  return out.join('\n')
}

const tableRows = (chunk) => {
  const rows = []
  for (const line of chunk.split('\n')) {
    const t = line.trim()
    if (!t.startsWith('|')) continue
    const cells = t.replace(/^\||\|$/g, '').split('|').map((s) => s.trim())
    if (cells.length < 2) continue
    if (/^-{2,}$/.test(cells[0]) || cells[0] === '' || cells[0] === '从' || cells[0] === 'ID') continue
    rows.push(cells)
  }
  return rows
}

/** 解析文档：主表 ID、章节 ID、覆盖账本、耦合边、锚点、mermaid。 */
export function parseDoc(text) {
  const block = (name) => {
    const out = []
    const re = new RegExp('<!--\\s*' + name + '\\s*([\\s\\S]*?)-->', 'g')
    let m
    while ((m = re.exec(text)) !== null) out.push({ at: m.index, body: m[1].trim() })
    return out
  }
  // 主表：① 可见表格（§ 查点主表 章节里首列是查点 ID 的行）；② 兼容 <!-- TABLE-ROW --> 注释块
  const tableIds = []
  for (const cells of tableRows(sectionOf(text, '2. 查点主表'))) if (ID_SHAPE.test(cells[0])) tableIds.push(cells[0])
  for (const b of block('TABLE-ROW')) {
    for (const line of b.body.split('\n')) {
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((s) => s.trim())
      if (cells.length >= 2 && ID_SHAPE.test(cells[0])) tableIds.push(cells[0])
    }
  }
  const sectionIds = [...text.matchAll(/^#{3,6}\s+([A-Za-z]{1,3}\d{1,3})\s+\S/gm)].map((m) => m[1])
  const coverage = []
  for (const b of block('COVERAGE')) {
    for (const line of b.body.split('\n')) {
      const t = line.trim()
      if (t === '' || t.startsWith('#')) continue
      if (t.startsWith('glob:')) coverage.push({ glob: norm(t.slice(5).trim()) })
      else coverage.push({ path: norm(t) })
    }
  }
  // 耦合边：① 可见表格（§ 耦合矩阵）；② 兼容 <!-- COUPLING --> 注释块里的 `A -> B | 关系 | 证据`
  const couplings = []
  for (const cells of tableRows(sectionOf(text, '4. 耦合矩阵'))) {
    if (cells.length < 3) continue
    couplings.push({
      from: cells[0], to: cells[1], note: cells.slice(2, -1).join(' | '), evidence: cells[cells.length - 1],
      raw: cells.join(' | '), parsed: ID_SHAPE.test(cells[0]),
    })
  }
  for (const b of block('COUPLING')) {
    for (const line of b.body.split('\n')) {
      const t = line.trim()
      if (t === '' || t.startsWith('#')) continue
      const [edge, note, evidence] = t.split('|').map((s) => (s ?? '').trim())
      const mm = edge.match(/^([A-Za-z]{1,3}\d{1,3})\s*->\s*([A-Za-z]{1,3}\d{1,3})$/)
      couplings.push({ from: mm ? mm[1] : edge, to: mm ? mm[2] : '', note, evidence, raw: t, parsed: !!mm })
    }
  }
  const anchors = []
  // 负向后顾：路径前不能是路径字符或 `:`（后者用来跳过 `coord:docs/...:12` 这类跨仓引用）
  for (const m of text.matchAll(ANCHOR_RE)) {
    if (m[1] !== undefined) {
      anchors.push({ path: norm(m[1]), line: Number(m[2]), ...parseExpectation(m[3]) })
    } else {
      anchors.push({
        path: norm(m[4]),
        line: m[7] === undefined ? null : Number(m[7]),
        symbol: m[5].replace(/::/g, '.'),
        symbolHash: m[6],
        symbolForm: true,
      })
    }
  }
  const mermaid = []
  const fences = text.split('```')
  for (let i = 1; i < fences.length; i += 2) {
    const body = fences[i]
    if (body.startsWith('mermaid')) mermaid.push(body)
  }
  return { tableIds, sectionIds, coverage, couplings, anchors, mermaid, fenceCount: fences.length - 1 }
}

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u

/**
 * 核心判定：对给定文档文本 + 注入的文件系统视图做检查。
 * fsView provides file existence, line count, and source-line content for each reference.
 */
export function checkDoc(text, universe, fsView, anchorBaseline = ANCHOR_BASELINE) {
  const issues = []
  const doc = parseDoc(text)
  const sourceLineBaseline = anchorBaseline.sourceLines ?? anchorBaseline
  const legacyReferenceCounts = anchorBaseline.legacyReferenceCounts
  const push = (kind, detail) => issues.push({ kind, detail })

  if (doc.coverage.length === 0) push('no-ledger', '文档缺少 <!-- COVERAGE --> 账本块')
  if (doc.tableIds.length === 0) push('no-table', '文档缺少 <!-- TABLE-ROW --> 主表行')

  // 1. 覆盖
  const exact = new Set(doc.coverage.filter((c) => c.path).map((c) => c.path))
  const globs = doc.coverage.filter((c) => c.glob).map((c) => ({ src: c.glob, re: globToRegExp(c.glob) }))
  for (const f of universe) {
    if (exact.has(f)) continue
    if (globs.some((g) => g.re.test(f))) continue
    push('uncovered', '未被任何查点覆盖：' + f)
  }
  for (const p of exact) if (!fsView.exists(p)) push('phantom-path', '覆盖账本里的路径不存在：' + p)

  // 2. 编号一致性
  const tableSet = new Set(doc.tableIds)
  const sectionSet = new Set(doc.sectionIds)
  for (const id of tableSet) if (!sectionSet.has(id)) push('missing-section', '主表有 ' + id + ' 但缺 ### 章节')
  for (const id of sectionSet) if (!tableSet.has(id)) push('missing-row', '章节 ' + id + ' 未登记进主表')
  const dup = doc.tableIds.filter((id, i) => doc.tableIds.indexOf(id) !== i)
  for (const id of new Set(dup)) push('dup-row', '主表重复登记：' + id)

  // 符号锚点的判别：符号在不在、符号体变没变。行号完全不参与判定。
  //
  // 两种判据：
  //  - 无 @hash：比对**整段符号体**（归一化后）。稳健但对同符号内的无关改动敏感。
  //  - 有 @hash：比对**该符号体内是否还含这行内容**。这是从 legacy 推导出来的锚点用的形式，
  //    把判据锚在推导当时的那一行上，同符号其它行改动不误伤。
  const checkSymbolReference = (path, symbol, symbolHash, hintLine, label) => {
    const src = fsView.sourceLines ? fsView.sourceLines(path) : null
    if (src === null) {
      push('bad-anchor', 'Referenced file does not exist: ' + path + '#' + symbol + ' (' + label + ')')
      return
    }
    const hit = symbolAt(src, symbol)
    if (!hit.found) {
      if (hit.ambiguous) {
        push('symbol-ambiguous', 'Symbol #' + symbol + ' in ' + path + ' has ' + hit.count
          + ' definitions (' + hit.sites.join(', ') + '); use #Class.method to disambiguate (' + label + ')')
      } else {
        push('symbol-missing', 'Symbol not found in ' + path + ': #' + symbol
          + (hintLine === null ? '' : '（提示行 ' + hintLine + '）') + ' (' + label + ')')
      }
      return
    }
    const key = path + '#' + symbol
    if (symbolHash !== undefined) {
      const bodyHashes = new Set(hit.body.split('\n').map((l) => contentHashOf(l)))
      const expected = (anchorBaseline.symbolHashes ?? {})[key + '@' + symbolHash]
      if (expected === undefined) {
        push('symbol-unbaselined', 'Symbol-hash anchor has no baseline entry (run --refresh-anchor-baseline): '
          + key + '@' + symbolHash)
        return
      }
      if (!bodyHashes.has(symbolHash)) {
        push('symbol-content-drift', 'Anchored line content vanished from ' + key + '@' + symbolHash
          + '（定义行 ' + hit.line + '）; rerun --refresh-anchor-baseline after review')
      }
      return
    }
    const expectedBody = (anchorBaseline.symbols ?? {})[key]
    if (expectedBody === undefined) {
      push('symbol-unbaselined', 'Symbol anchor has no baseline body (run --refresh-anchor-baseline): ' + key)
      return
    }
    if (expectedBody !== hit.body) {
      push('symbol-body-drift', 'Symbol body changed at ' + key
        + '（定义行 ' + hit.line + '）; rerun --refresh-anchor-baseline after review')
    }
    // 行号变了不判红：这正是本方案要消灭的假红。
  }

  const checkedReferences = new Set()
  const checkReference = (path, line, expectation, expectationError, label) => {
    const key = path + ':' + line
    const uniqueCheck = key + '#' + (expectation ?? '') + '#' + (expectationError ?? '')
    if (checkedReferences.has(uniqueCheck)) return
    checkedReferences.add(uniqueCheck)

    const n = fsView.lineCount(path)
    if (n === null) {
      push('bad-anchor', 'Referenced file does not exist: ' + key + ' (' + label + ')')
      return
    }
    if (line < 1 || line > n) {
      push('bad-anchor', 'Referenced line is out of range: ' + key + ' (file has ' + n + ' lines; ' + label + ')')
      return
    }

    const contents = fsView.lineContents ? fsView.lineContents(path, line) : []
    if (expectationError) {
      push('bad-anchor-expectation', 'Invalid expectation for ' + key + ': ' + expectationError)
      return
    }
    if (expectation !== undefined) {
      const matches = contents.filter((candidate) => candidate.text.includes(expectation))
      const matchingFiles = new Set(matches.map((candidate) => candidate.file))
      if (matches.length === 0) {
        const actual = contents.map((candidate) => JSON.stringify(candidate.text)).join(', ') || '<unavailable>'
        push('bad-anchor-content', 'Expected ' + JSON.stringify(expectation) + ' at ' + key + ', actual line: ' + actual)
      } else if (matchingFiles.size !== 1) {
        push('ambiguous-anchor', 'Expectation ' + JSON.stringify(expectation) + ' matches ' + matchingFiles.size + ' files for ' + key + '; use a repository-relative path')
      }
      return
    }

    const expected = sourceLineBaseline[key]
    if (!Array.isArray(expected) || expected.length === 0) {
      push('missing-anchor-expectation', 'New or changed reference must include #expect=<encoded-fragment>: ' + key)
      return
    }
    if (!contents.some((candidate) => expected.includes(candidate.text))) {
      const actual = contents.map((candidate) => JSON.stringify(candidate.text)).join(', ') || '<unavailable>'
      push('anchor-content-drift', 'Referenced content changed at ' + key + '; expected one of ' + JSON.stringify(expected) + ', actual: ' + actual)
    }
  }

  if (legacyReferenceCounts) {
    for (const [key, count] of increasedLegacyReferences(doc.anchors, legacyReferenceCounts)) {
      if (Object.hasOwn(sourceLineBaseline, key)) {
        push('moved-anchor', 'New or moved legacy reference needs #expect=<encoded-fragment>: ' + key
          + ' (baseline count ' + (legacyReferenceCounts[key] ?? 0) + ', current count ' + count + ')')
      }
    }
  }

  // 3. 耦合边（右端可以是「外部角色」文字，只有形如查点 ID 的才要求已登记）
  for (const c of doc.couplings) {
    if (!c.parsed) { push('bad-coupling', '耦合边格式应为 `A -> B | 关系 | path:line`：' + c.raw); continue }
    if (!tableSet.has(c.from)) push('bad-coupling', '耦合边左端未登记：' + c.from + '（' + c.raw + '）')
    if (ID_SHAPE.test(c.to) && !tableSet.has(c.to)) push('bad-coupling', '耦合边右端是查点 ID 但未登记：' + c.to + '（' + c.raw + '）')
    const ev = (c.evidence || '').match(EVIDENCE_RE)
    if (!ev) push('bad-coupling', '耦合边缺 `path:line` 证据：' + c.raw)
    else if (ev[3] !== undefined && parseExpectation(ev[3]).expectError) {
      push('bad-coupling', '耦合边证据含无效期望片段：' + c.raw)
    }
  }

  // 4. 锚点
  const seen = new Set()
  for (const a of doc.anchors) {
    if (a.symbolForm) {
      seen.add(a.path + '#' + a.symbol)
      checkSymbolReference(a.path, a.symbol, a.symbolHash, a.line, 'anchor')
      continue
    }
    const key = a.path + ':' + a.line
    seen.add(key)
    checkReference(a.path, a.line, a.expect, a.expectError, 'anchor')
  }
  // 5. 排版
  if (EMOJI_RE.test(text)) push('emoji', '文档含 emoji（仓铁律：提交/文档/标签一律不用）')
  let open = false
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('```')) open = !open
  }
  if (open) push('fence', 'mermaid/代码围栏未闭合')
  for (const block of doc.mermaid) {
    const styleHit = block.split('\n').find((l) => /^\s*(style|classDef|linkStyle)\b/.test(l))
    if (styleHit) push('mermaid-style', 'mermaid 块里出现 ' + styleHit.trim() + '（渲染兼容：不用样式指令）')
    const nodes = block.split('\n').filter((l) => /-->|->>|participant |\["/.test(l)).length
    if (nodes < 2) push('mermaid-empty', 'mermaid 块看不出流程（节点/边少于 2 行）')
  }
  return { issues, stats: {
    blocks: tableSet.size, coverage: doc.coverage.length, anchors: seen.size,
    couplings: doc.couplings.length, mermaid: doc.mermaid.length,
  } }
}

/** 收集覆盖全域（仓内实际文件）。 */
function collectUniverse(repo) {
  const files = []
  const walk = (root, keep) => {
    const abs = join(repo, root)
    if (!existsSync(abs)) return
    const rec = (dir) => {
      for (const name of readdirSync(dir)) {
        if (SKIP_DIRS.has(name)) continue
        const full = join(dir, name)
        if (statSync(full).isDirectory()) rec(full)
        else {
          const rel = norm(relative(join(repo, root), full))
          if (keep(rel)) files.push(norm(join(root, rel)))
        }
      }
    }
    rec(abs)
  }
  for (const rule of UNIVERSE) walk(rule.root, rule.keep)
  return files.sort()
}

function makeFsView(repo, parent) {
  const cache = new Map()
  const fileLines = new Map()
  const weak = new Set()
  const locate = (rel) => {
    for (const root of [repo, parent].filter((r) => r !== null)) {
      const abs = join(root, rel)
      if (existsSync(abs)) return abs
    }
    return null
  }
  const linesOf = (abs) => {
    if (fileLines.has(abs)) return fileLines.get(abs)
    try {
      const lines = readFileSync(abs, 'utf8').split('\n')
      fileLines.set(abs, lines)
      return lines
    } catch {
      fileLines.set(abs, null)
      return null
    }
  }
  const lineContentsOf = (abs, line) => {
    const lines = linesOf(abs)
    const value = lines?.[line - 1]
    return value === undefined ? null : value.trim()
  }
  // 裸文件名（正文里常写 `BrowserHost.kt:498`）按全仓同名文件解析：唯一=严格，多候选=弱锚点
  let index = null
  const buildIndex = () => {
    index = new Map()
    const rec = (dir) => {
      let names = []
      try { names = readdirSync(dir) } catch { return }
      for (const name of names) {
        if (SKIP_DIRS.has(name)) continue
        const full = join(dir, name)
        let st = null
        try { st = statSync(full) } catch { continue }
        if (st.isDirectory()) rec(full)
        else {
          const list = index.get(name) ?? []
          list.push(full)
          index.set(name, list)
        }
      }
    }
    rec(repo)
  }
  /**
   * 取整份源码行数组（符号锚点用）。
   *
   * 裸文件名（`index.ts` 这种）可能对应多份文件。这里**只在唯一时**返回，
   * 多候选一律返回 null —— 否则符号会在错误的文件里解析（实测会让 27 条锚点
   * 因「行号越界」推导失败，或者更糟：把锚点绑到错的同名符号上）。
   * 用户决定 2：推导不出就判红/保持 legacy，不猜。
   */
  const sourceLinesOf = (rel) => {
    const abs = locate(rel)
    if (abs) return linesOf(abs)
    if (!rel.includes('/')) {
      if (index === null) buildIndex()
      const cands = index.get(rel) ?? []
      if (cands.length !== 1) {
        if (cands.length > 1) weak.add(rel)
        return null
      }
      return linesOf(cands[0])
    }
    return null
  }
  return {
    weak,
    sourceLines: sourceLinesOf,
    exists: (rel) => locate(rel) !== null,
    lineContents: (rel, line) => {
      const abs = locate(rel)
      if (abs) {
        const text = lineContentsOf(abs, line)
        return text === null ? [] : [{ file: abs, text }]
      }
      if (!rel.includes('/')) {
        if (index === null) buildIndex()
        return (index.get(rel) ?? []).flatMap((file) => {
          const text = lineContentsOf(file, line)
          return text === null ? [] : [{ file, text }]
        })
      }
      return []
    },
    lineCount: (rel) => {
      if (cache.has(rel)) return cache.get(rel)
      let n = null
      const abs = locate(rel)
      if (abs) n = linesOf(abs)?.length ?? null
      else if (!rel.includes('/')) {
        if (index === null) buildIndex()
        const cands = index.get(rel) ?? []
        if (cands.length > 0) {
          weak.add(rel)
          n = Math.max(...cands.map((file) => linesOf(file)?.length).filter((x) => typeof x === 'number'))
        }
      }
      cache.set(rel, n)
      return n
    },
  }
}

function selfTest() {
  const universe = ['app/a.kt', 'app/b.kt']
  const mk = (map) => ({
    exists: (p) => Object.prototype.hasOwnProperty.call(map, p),
    lineCount: (p) => (Object.prototype.hasOwnProperty.call(map, p) ? map[p].length : null),
    lineContents: (p, line) => (Object.prototype.hasOwnProperty.call(map, p) && map[p][line - 1] !== undefined
      ? [{ file: p, text: map[p][line - 1].trim() }] : []),
    sourceLines: (p) => (Object.prototype.hasOwnProperty.call(map, p) ? map[p] : null),
  })
  const fsFull = mk({ 'app/a.kt': ['header', 'fun ready()', 'fun other()', 'fun helper()'], 'app/b.kt': ['field', 'value'] })
  const baseline = {
    sourceLines: { 'app/a.kt:3': ['fun other()'], 'app/a.kt:4': ['fun helper()'] },
    legacyReferenceCounts: { 'app/a.kt:3': 1, 'app/a.kt:4': 1 },
  }
  const head = '<!-- COVERAGE\n'
  const clean = '<!-- TABLE-ROW\n| K01 | 甲 | 一句话 | 入口 | 稳态控制 | - | - | app/a.kt | 低 |\n-->\n'
    + '### K01 甲\n\n- **一句话**：x\n- 关键坐标：`app/a.kt:3`\n\n<!-- COUPLING\nK01 -> K01 | 自环 | app/a.kt:4\n-->\n'
    + head + 'app/a.kt\napp/b.kt\n-->\n'
  const cases = [
    ['A valid document passes', clean, fsFull, 0, baseline],
    ['An uncovered file is rejected', clean.replace('app/b.kt\n-->\n', '-->\n'), fsFull, 1, baseline],
    ['A nonexistent coverage path is rejected', clean.replace('app/b.kt\n-->\n', 'app/b.kt\napp/none.kt\n-->\n'), fsFull, 1, baseline],
    ['An out-of-range anchor is rejected', clean.replace('app/a.kt:3', 'app/a.kt:99'), fsFull, 1, baseline],
    ['A missing anchor file is rejected', clean.replace('app/a.kt:3', 'app/ghost.kt:3'), fsFull, 1, baseline],
    ['A mismatched expected fragment is rejected', clean.replace('app/a.kt:3', 'app/a.kt:3#expect=notPresent'), fsFull, 1, baseline],
    ['A matching expected fragment passes', clean.replace('app/a.kt:3', 'app/a.kt:3#expect=other'), fsFull, 0, baseline],
    ['Malformed URI-encoded expectation is rejected', clean.replace('app/a.kt:3', 'app/a.kt:3#expect=%zz'), fsFull, 1, baseline],
    ['A new anchor without an expected fragment is rejected', clean.replace('app/a.kt:3', 'app/a.kt:2'), fsFull, 1, baseline],
    ['Moving an anchor to another known line requires an expectation', clean.replace('app/a.kt:3', 'app/a.kt:4'), fsFull, 1, baseline],
    ['Legacy anchor content drift is rejected', clean, mk({ 'app/a.kt': ['header', 'fun ready()', 'changed body()', 'fun helper()'], 'app/b.kt': ['field', 'value'] }), 1, baseline],
    ['Mismatched coupling evidence is rejected', clean.replace('app/a.kt:4', 'app/a.kt:4#expect=missing'), fsFull, 1, baseline],
    ['An expected fragment uniquely resolves a duplicate basename', clean.replace('app/a.kt:3', 'index.ts:3#expect=screenScope'), {
      exists: (p) => p === 'app/a.kt' || p === 'app/b.kt',
      lineCount: (p) => p === 'index.ts' ? 3 : (p === 'app/a.kt' ? 4 : (p === 'app/b.kt' ? 2 : null)),
      lineContents: (p, line) => p === 'index.ts' && line === 3
        ? [{ file: 'plugins/bridge/index.ts', text: 'const screenScope = true' }, { file: 'plugins/manage/index.ts', text: 'const manage = true' }]
        : fsFull.lineContents(p, line),
    }, 0, { sourceLines: { 'app/a.kt:4': ['fun helper()'] } }],
    ['An ambiguous expected fragment is rejected', clean.replace('app/a.kt:3', 'index.ts:3#expect=shared'), {
      exists: (p) => p === 'app/a.kt' || p === 'app/b.kt',
      lineCount: (p) => p === 'index.ts' ? 3 : (p === 'app/a.kt' ? 4 : (p === 'app/b.kt' ? 2 : null)),
      lineContents: (p, line) => p === 'index.ts' && line === 3
        ? [{ file: 'plugins/bridge/index.ts', text: 'shared screenScope' }, { file: 'plugins/manage/index.ts', text: 'shared manage' }]
        : fsFull.lineContents(p, line),
    }, 1, { sourceLines: { 'app/a.kt:4': ['fun helper()'] } }],
    ['Mismatched table and section IDs are rejected', clean.replace('### K01 甲', '### K02 甲'), fsFull, 2, baseline],
    ['A coupling without evidence is rejected', clean.replace('| 自环 | app/a.kt:4', '| 自环 |'), fsFull, 1, baseline],
    ['Emoji is rejected', clean.replace('### K01 甲', '### K01 甲 ' + String.fromCodePoint(0x26A0)), fsFull, 1, baseline],
  ]
  // ── 符号锚点（方案 B，2026-10-28 用户裁定）────────────────────────────────
  // 只有两条会红：① 符号消失；② 符号体（归一化后）变了。
  // 行号变化、上方插代码、加空行、纯缩进变化 —— 一律绿。这是本方案存在的理由。
  const symSrc = ['header', 'fun alpha() {', '  return 1', '}', '', 'fun beta() {', '  return 2', '}']
  const curSym = (lines, s2) => { const h = symbolAt(lines, s2); return h.found ? h.body : null }
  const sBase = {
    sourceLines: { 'app/a.kt:4': ['fun helper()'] },
    legacyReferenceCounts: { 'app/a.kt:4': 1 },
    symbols: { 'app/c.kt#alpha': curSym(symSrc, 'alpha') },
  }
  const symDoc = '<!-- TABLE-ROW\n| K01 | 甲 | 一句话 | 入口 | 稳态控制 | - | - | app/a.kt | 低 |\n-->\n'
    + '### K01 甲\n\n- **一句话**：x\n- 关键坐标：`app/c.kt#alpha`\n\n'
    + '<!-- COUPLING\nK01 -> K01 | 自环 | app/a.kt:4\n-->\n'
    + head + 'app/a.kt\napp/b.kt\napp/c.kt\n-->\n'
  const symFs = (src) => mk({
    'app/a.kt': ['header', 'fun ready()', 'fun other()', 'fun helper()'],
    'app/b.kt': ['field', 'value'],
    'app/c.kt': src,
  })
  cases.push(
    ['SYM 行号偏移不判红（上方插 3 行）', symDoc, symFs(['h1', 'h2', 'h3', ...symSrc]), 0, sBase, ['app/a.kt', 'app/b.kt', 'app/c.kt']],
    ['SYM 加空行不判红', symDoc, symFs(['header', '', 'fun alpha() {', '', '  return 1', '', '}', '', 'fun beta() {', '  return 2', '}']), 0, sBase, ['app/a.kt', 'app/b.kt', 'app/c.kt']],
    ['SYM 纯缩进变化不判红', symDoc, symFs(['header', 'fun alpha() {', '        return 1', '}', '', 'fun beta() {', '  return 2', '}']), 0, sBase, ['app/a.kt', 'app/b.kt', 'app/c.kt']],
    ['SYM 符号改名判红', symDoc, symFs(['header', 'fun renamed() {', '  return 1', '}', '', 'fun beta() {', '  return 2', '}']), 1, sBase],
    ['SYM 函数体改了判红', symDoc, symFs(['header', 'fun alpha() {', '  return 99', '}', '', 'fun beta() {', '  return 2', '}']), 1, sBase],
    ['SYM 未登记基线判红', symDoc, symFs(symSrc), 1, { sourceLines: { 'app/a.kt:4': ['fun helper()'] }, legacyReferenceCounts: { 'app/a.kt:4': 1 }, symbols: {} }],
  )

  let pass = 0
  const lines = []
  for (const [name, text, fsView, want, expected, uni] of cases) {
    const { issues } = checkDoc(text, uni ?? universe, fsView, expected)
    const ok = issues.length === want
    if (ok) pass += 1
    lines.push((ok ? '  ok   ' : '  FAIL ') + name + ': matched ' + issues.length + ' / expected ' + want
      + (ok ? '' : ' -> ' + issues.map((i) => i.kind).join(',')))
  }
  const ok = pass === cases.length
  console.log((ok ? 'CHECK-CODE-MAP SELF-TEST PASSED' : 'CHECK-CODE-MAP SELF-TEST FAILED'))
  for (const l of lines) console.log(l)
  process.exit(ok ? 0 : 1)
}

// 仅作为主程序执行时跑校验；被 import 时只暴露纯函数（便于探针/其他门禁复用）。
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  if (SELF_TEST) selfTest()

  const docAbs = resolvePath(REPO, DOC_REL)
  if (!existsSync(docAbs)) {
    console.error('CHECK-CODE-MAP FAILED：地图文档不存在：' + DOC_REL + '（先写文档，或 --doc 指定）')
    process.exit(2)
  }
  const text = readFileSync(docAbs, 'utf8')
  const universe = collectUniverse(REPO)
  const fsView = makeFsView(REPO, NO_PARENT ? null : PARENT)
  // ── 推导迁移 / dry-run（用户决定 1）──────────────────────────────────────
  // 把 legacy 锚点（path:line + 该行内容）推导成可自愈的符号锚点：
  //   能唯一推导出符号 -> `path#Symbol@<内容哈希>`
  //   内容在全文不唯一 / 同名多符号且推不出宿主类 -> 保持 legacy 并列出，不猜
  if (DERIVE_ANCHORS || DERIVE_DRY_RUN) {
    const parsed = parseDoc(text)
    const report = { symbol: [], disambiguated: [], content: [], failed: [] }
    const rewrites = new Map()
    for (const a of parsed.anchors) {
      if (a.symbolForm) continue
      const src = fsView.sourceLines(a.path)
      if (src === null) { report.failed.push({ key: a.path + ':' + a.line, reason: '文件不存在' }); continue }
      const lineText = src[a.line - 1]
      if (lineText === undefined) { report.failed.push({ key: a.path + ':' + a.line, reason: '行号越界' }); continue }
      const hash = contentHashOf(lineText)
      const d = deriveSymbolAnchor(src, a.line, hash)
      if (!d.ok) { report.failed.push({ key: a.path + ':' + a.line, reason: d.reason, text: lineText.trim().slice(0, 60) }); continue }
      const target = d.symbol === null
        ? a.path + '@' + d.hash
        : a.path + '#' + d.symbol + '@' + d.hash
      report[d.kind].push({ key: a.path + ':' + a.line, target, text: lineText.trim().slice(0, 60) })
      rewrites.set(a.path + ':' + a.line, target)
    }
    const total = report.symbol.length + report.disambiguated.length + report.content.length
    console.log('锚点推导' + (DERIVE_DRY_RUN ? '（dry-run，不写盘）' : '') + '：')
    console.log('  可推导 ' + total + ' 条（唯一符号 ' + report.symbol.length
      + ' / 消歧后 ' + report.disambiguated.length + ' / 全文内容唯一 ' + report.content.length + '）')
    console.log('  推导不出 ' + report.failed.length + ' 条（保持 legacy，需人工）')
    const byReason = {}
    for (const f of report.failed) byReason[f.reason] = (byReason[f.reason] ?? 0) + 1
    for (const [k, v] of Object.entries(byReason).sort((x, y) => y[1] - x[1])) console.log('    ' + v + '  ' + k)
    if (DERIVE_DRY_RUN) {
      const outPath = process.env.DERIVE_REPORT ?? 'derive-report.json'
      writeFileSync(outPath, JSON.stringify({ total, ...report }, null, 2) + '\n')
      console.log('  明细已写入 ' + outPath)
      if (report.failed.length > 0) {
        console.log('  --- 推导不出（前 20）---')
        for (const f of report.failed.slice(0, 20)) console.log('    ' + f.key + '  ' + f.reason + (f.text ? '  | ' + f.text : ''))
      }
      process.exit(0)
    }
    // 真正改写文档：把 `path:line` 文本替换成推导出的符号锚点
    let out = text
    let replaced = 0
    for (const [key, target] of rewrites) {
      const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(esc + '(?!#expect=)', 'g')
      out = out.replace(re, () => { replaced += 1; return target })
    }
    writeFileSync(docAbs, out)
    console.log('  已改写 ' + replaced + ' 处引用 -> ' + DOC_REL)
    console.log('  下一步：node scripts/check-code-map.mjs --refresh-anchor-baseline')
    process.exit(0)
  }

  if (REFRESH_ANCHOR_BASELINE) {
    const parsed = parseDoc(text)
    const sourceLineBaseline = ANCHOR_BASELINE.sourceLines ?? ANCHOR_BASELINE
    const legacyReferenceCounts = ANCHOR_BASELINE.legacyReferenceCounts
    if (legacyReferenceCounts) {
      const moved = increasedLegacyReferences(parsed.anchors, legacyReferenceCounts)
        .filter(([key]) => Object.hasOwn(sourceLineBaseline, key))
      if (moved.length > 0) {
        console.error('Cannot refresh moved legacy references; add #expect=<encoded-fragment>: '
          + moved.slice(0, 20).map(([key]) => key).join(', '))
        process.exit(1)
      }
    }
    const references = new Set(parsed.anchors
      .filter((a) => !a.symbolForm && a.expect === undefined && a.expectError === undefined)
      .map((a) => a.path + ':' + a.line))
    for (const c of parsed.couplings) {
      const ev = (c.evidence || '').match(EVIDENCE_RE)
      if (ev && ev[3] === undefined && !parseExpectation(ev[3]).expectError) {
        references.add(norm(ev[1]) + ':' + Number(ev[2]))
      }
    }
    const unknown = [...references].filter((key) => !Object.hasOwn(sourceLineBaseline, key))
    if (unknown.length > 0) {
      console.error('Cannot refresh baseline for new references; add #expect=<encoded-fragment>: ' + unknown.slice(0, 20).join(', '))
      process.exit(1)
    }
    const sourceLines = {}
    for (const key of [...references].sort()) {
      const split = key.lastIndexOf(':')
      const contents = fsView.lineContents(key.slice(0, split), Number(key.slice(split + 1)))
      if (contents.length === 0) {
        console.error('Cannot refresh missing reference content: ' + key)
        process.exit(1)
      }
      sourceLines[key] = [...new Set(contents.map((candidate) => candidate.text))].sort()
    }
    // 符号锚点：缓存「符号体归一化结果」。行号**不写入基线**——它只是缓存。
    const symbols = { ...(anchorBaselineSymbols()) }
    const symbolKeys = parsed.anchors.filter((a) => a.symbolForm)
    for (const a of symbolKeys) {
      const src = fsView.sourceLines(a.path)
      if (src === null) {
        console.error('Cannot refresh symbol anchor (file missing): ' + a.path + '#' + a.symbol)
        process.exit(1)
      }
      const hit = symbolAt(src, a.symbol)
      if (!hit.found) {
        console.error('Cannot refresh symbol anchor (symbol missing): ' + a.path + '#' + a.symbol)
        process.exit(1)
      }
      symbols[a.path + '#' + a.symbol] = hit.body
    }
    writeFileSync(ANCHOR_BASELINE_ABS, JSON.stringify({
      formatVersion: 2,
      legacyReferenceCounts: countLegacyReferences(parsed.anchors),
      sourceLines,
      symbols,
    }, null, 2) + '\n')
    console.log('CHECK-CODE-MAP baseline refreshed: ' + references.size + ' legacy references, '
      + symbolKeys.length + ' symbol anchors')
    process.exit(0)
  }
  const { issues, stats } = checkDoc(text, universe, fsView)

  console.log('执行地图: ' + DOC_REL + '（基线 repo=' + REPO + '）')
  console.log('盘点: 查点 ' + stats.blocks + ' · 覆盖条目 ' + stats.coverage + ' · 锚点 ' + stats.anchors
    + ' · 耦合边 ' + stats.couplings + ' · 流程图 ' + stats.mermaid + ' · 全域文件 ' + universe.length)
  if (LIST_ONLY) {
    const kinds = {}
    for (const i of issues) kinds[i.kind] = (kinds[i.kind] ?? 0) + 1
    console.log('盘点明细（--list 不判红，最多 200 条）：')
    for (const i of issues.slice(0, 200)) console.log('  - [' + i.kind + '] ' + i.detail)
    if (issues.length > 200) console.log('  ... 另有 ' + (issues.length - 200) + ' 条')
    console.log('汇总: ' + (issues.length === 0 ? '无' : JSON.stringify(kinds)))
    process.exit(0)
  }
  if (issues.length > 0) {
    console.error('CHECK-CODE-MAP FAILED（' + issues.length + ' 项）：')
    for (const i of issues.slice(0, 40)) console.error('  - [' + i.kind + '] ' + i.detail)
    if (issues.length > 40) console.error('  ... 另有 ' + (issues.length - 40) + ' 项')
    process.exit(1)
  }
  console.log('CHECK-CODE-MAP PASSED（覆盖完整、锚点有效、编号一致）')
}
