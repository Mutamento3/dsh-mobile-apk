# dsh-mobile-apk README 全面改版策划案（2026-10-24）

> 本文件只做策划，不改 README 本体。下一轮按本方案的「实施步骤」真正重写。
> 既定决策（不再讨论）：1) README 转向用户宣发、做成常青文档；2) 正文不写产品版本号（0.14.x / versionCode / 引擎版本，下载占位改「最新版」）；3) 开发者内容（构建、桥协议、工具面、版本历史）迁出 README 并给出去处；4) 生态四仓链接行撤下；5) bash 已内置（Termux bash），可如实写；「完整 Linux 运行环境」属 0.15.0 规划，本轮不写（用户 2026-10-24 拍板）。开放问题 8 条已全部拍板，决议见 §7。
> 素材基线：现状盘点（本轮 ask 提供）、近三版发版卖点（`release/v0.14.9/notes.md`、`release/v0.14.8/notes.md`、`release/v0.14.7/notes.md`，位于协调仓 dsh-mobile）、长期功能面卖点（`dsh-mobile-apk/AGENTS.md` 与 `dsh-mobile-apk/docs/AGENTS/*` 详档）、同类项目 README 调研（termux-app / gkd / droidrun(Mobilerun) / RikkaApps/Shizuku / AndronixOrigin / openautojs）。文中引用均已在本轮核对原文。

## 0. 为什么必须改：三个实锤

1. **版本号已过期且会持续过期**。`dsh-mobile-apk/README.md:20` 写「当前源码版本 0.14.6（versionCode 50）」，而协调仓 `release/v0.14.9/notes.md:3` 已是「versionCode 53 / versionName 0.14.9」——README 落后三个版本。「当前版本」这句话天生必腐。
2. **受众错位**。仓库首页现在一半篇幅给开发者：桥协议四张表（README.md:126-181）、45 工具清单（README.md:183-197）、构建命令（README.md:105-124）；而用户最需要的「它能帮我做什么、怎么装、装错会怎样」被实现细节淹没。
3. **双语双写已经漂移**。推广链接 d1api.xin 只在中文版（README.md:13，英文版第 10 行生态行没有）；「支持我们」英文版中英混排而中文版纯中文（README.en.md:273-278 vs README.md:244-251）。双镜像不立同步规则，漂移只会随改版放大。

## 1. 定位与目标读者

**新 README 一句话定位**：面向用户宣发的常青文档——一屏说清「一个 APK 装下完整 AI agent：AI 能操作浏览器与手机、真实执行 bash，无需 root、无需刷机」，只承载能力、下载入口与如实的前置条件；版本信息交给 Releases 页，开发者细节交给 docs/AGENTS 详档与 CONTRIBUTING。（bash 为内置 Termux 环境的 Termux bash；「完整 Linux 运行环境」是 0.15.0 规划，定位句不写。）

**目标读者与优先级**：

| 层级 | 是谁 | 来干嘛 | README 给什么 |
|---|---|---|---|
| 主读者 | 尚未安装的潜在用户 | 判断值不值得装、怎么装 | 首屏定位、特性亮点、截图、下载安装四步、FAQ |
| 次读者 | 已装用户 | 排障、开权限、加群 | 权限表、FAQ、诊断与自愈说明、用户群二维码 |
| 末读者 | 开发者/贡献者 | 找接口、找构建链 | 每处只给一行指路（BRIDGE-API.md / build-and-env.md / CONTRIBUTING.md） |

**第一屏让用户记住的两件事**：
1. 它是什么：手机上的完整 AI agent，AI 能操作浏览器与手机、真实执行 bash——不用 root、不用刷机；
2. 去哪下：Releases 最新版，真机 arm64 / 模拟器 x86_64，装对包即用。

第一屏只保留：标题、双语互链、badge 行、一句话定位、两行免责。版本流水迁出、生态链接撤下、推广链接下移至文末（素材来源：调研 recommendations「首屏只留两样：它是什么、去哪下」）。

**内容红线（宣发不夸大的执行标准）**：
- 每个功能点必须能指到素材来源（发版 notes、详档、代码）；文案库里逐条附来源，重写时照抄不自由发挥。
- 每条限制写成「前置条件 + 出路」，不写成恐吓段（Termux 式「警告绑定动作」、Andronix 式「限制后跟出路」）。
- 不写任何「当前版本」句式；能力表述用「现已支持 / 需要开启」，不用「X.Y.Z 起支持」。
- 平台限定词（Android 13+、API 33+、WebView 110）是稳定事实，保留，但改写成用户语言（如「Android 13 及以上需在系统设置里允许通知」）。

## 2. 章节大纲（新 README 逐节策划）

新 README 全文预计 150-200 行（现 251 行），按以下顺序组织。每节给：目的、内容要点、素材来源映射、与旧 README 的关系。

### 2.1 标题与双语互链
- 目的：保持仓库首页身份与双语入口。
- 内容：H1 不变（`dsh-mobile-apk — DeepSeek Harness 安卓壳 APK` 可在改版时顺手改为更用户向的 `dsh-mobile-apk — 手机上的 AI Agent（DeepSeek Harness 安卓壳）`，属文案细节）；首行互链 `English README` / `中文说明`（现状 README.md:3、README.en.md:3 的 🌐 字符改纯文字，拍板：emoji 不放开）。
- 保留：旧 README.md:1-3 全部。

### 2.2 badge 行
- 目的：信任背书，4-6 个封顶（调研：Mobilerun/GKD 惯例）。
- 内容：License (MIT)、GitHub Release（latest）、Android 8.0+（minSdk 26，`dsh-mobile-apk/AGENTS.md:18`）、QQ 群（末位保留，现 README.md:5-6）；CI badge 拍板暂不挂。Cloudflare 与 DeepSeek Harness/Android 装饰性徽章（README.md:7-10）撤下或收进文末生态节——它们不承载用户决策信息。
- 保留：QQ 群/QQ2群 徽章（must-carry-over）。

### 2.3 一句话定位（首屏）
- 目的：3 秒讲清产品（GKD/Mobilerun 范式）。
- 内容：照 Andronix 句式给最硬承诺：
  > 一个 APK 装下完整的 AI agent：AI 能操作浏览器与手机、真实执行 bash——无需 root，无需刷机。
  素材来源：README.md:15-17（内嵌 Termux 运行时，bash 为 Termux bash）；「无需 root」有据——root 是可选高级授权（`docs/AGENTS/ARCHITECTURE.md` RootGrant/RootAccess 族），Shizuku/无障碍均为免 root 通道。「完整 Linux 运行环境」为 0.15.0 规划（拍板），定位句与首屏均不写。
- 应用身份一行（应用名 DeepCode、包名 com.dsharnessmobile.shell）保留，**版本号句摘除**（README.md:19-20 → 只留 :19）。
- 处置（拍板）：README.md:12 生态四仓链接行整体撤下，不进新 README；README.md:13 d1api.xin 推广链接保留但移出首屏，放文末「支持我们」节并如实标注。

### 2.4 免责与预期管理（两行）
- 目的：GKD 式两行收口，紧跟首屏，不展开成段落。
- 内容：
  > 本项目基于 MIT 开源，仅供学习交流与研究，禁止用于商业或非法用途。
  > AI 生成内容与执行的操作请自行判断；实验性能力会在对应条目如实标注。
- 插件市场（拍板）：相关内容整体不进新 README——旧首屏警示块（README.md:22-25）撤下，FAQ 对应条目改为通用的「出问题去哪反馈」（保留报错附机型/版本/复现步骤到 issues 的事实点）；插件市场的 beta 定位与可用性说明由应用内提示承载。

### 2.5 核心特性（它能做什么）
- 目的：用户视角亮点，5-8 条 bullet。实验性能力在括号内如实标注——这是本次改版新立的规则，不是旧 README 的既有惯例（旧 README 全文无实验标注：本轮 `grep -n "实验" dsh-mobile-apk/README.md` 零命中，exit=1；README.md:18 实为简介句）。如实基调的出处可引 ARCHITECTURE.md:159-161「本节记录代码施工状态，不表示已通过设备验收」。
- 内容与来源：从「功能卖点文案库」（本方案第 3 章）选核心条目：
  1. AI 真实执行 bash：AI 跑的命令在内置 Termux 环境里真实生效（README.md:31-32；bash 为 Termux bash）；
  2. 后台持续运行与自动恢复（ARCHITECTURE.md:54-56、:73）；
  3. AI 独立浏览器，cookie 与日常浏览器隔离（ARCHITECTURE.md:26）（实验特性）；
  4. 虚拟屏：AI 在独立屏幕操作第三方 App（README.md:53-66）（实验特性，需 Shizuku）；
  5. AI 操作手机：无障碍 + Shizuku 双通道（ARCHITECTURE.md:78、:173）；
  6. 通知栏直接应答与审批（ARCHITECTURE.md:80-84）；
  7. 桌面悬浮球看进度（ARCHITECTURE.md:36-44）；
  8. 故障自愈、安全模式、脱敏诊断包、启动修复助手（changelog-archive.md:19、EXECUTION-MAP.md:70、changelog-archive.md:15、`release/v0.14.9/notes.md` §3）。
- 「完整 Linux 运行环境（完整工具链）」为 0.15.0 规划（拍板），本轮不写工具链清单、不写「完全离线」；bash 已在（Termux bash），按条目 1 如实写。
- 全部实现细节句（refreshSnapshot、SafeActivityOptions 拒绝、guard() 异步解析、am start --display 唯一路径论证，README.md:57-59、:72-75 等）随桥协议/详档迁移，README 只留用户可感知的结果句。
- 保留：README.md:27-85 中的用户视角事实；版本门槛句（:33、:39）摘除。

### 2.6 界面速览（截图）
- 目的：现在零截图（与 Termux/Shizuku 同病，调研公认是「读感偏冷」主因）。
- 内容：2x2 截图表格——主界面与对话、右侧分栏双工作区、虚拟屏浮窗、通知应答/悬浮球。首屏可加 320 宽 GIF（10-20 秒「一句话 → agent 真实执行 bash → 返回结果」，Mobilerun 范式），为加分项可后补；演示以当前版本实测为准，不演示 0.15.0 的完整工具链能力。
- 素材来源：模拟器验收截图是验收流程副产品（`docs/AGENTS/emulator-test-protocol.md` 的真实任务截图），素材不缺，缺搬运。新素材，无旧对应。

### 2.7 快速开始（要求表 + 四步）
- 目的：编号步骤，每步一行（Mobilerun Quickstart 范式），前置条件内嵌进步骤而非单列吓人章节。
- 内容：
  - 设备要求小表（Andronix 范式）：Android 8.0+（minSdk 26）；安装包约 150 MB 级、建议 Wi-Fi（`release/v0.14.9/notes.md` 候选产物表实测 161,996,841 / 158,532,117 字节）；无需 root（可选 Shizuku 解锁高级设备控制）。
  - 四步：1) 下载匹配 ABI 的 APK（链接 releases/latest）；2) 安装并首次启动，等待运行环境解压完成（数分钟，勿强杀）；3) 按需开权限（无障碍 / 通知 / Shizuku，应用内有引导）；4) 配置模型 API，跑第一条命令。
- 保留：README.md:96-98 adb install 命令（折叠进步骤 1 的进阶说明）。

### 2.8 下载与安装
- 目的：下载引导不写版本号，保留 ABI 警示。
- 内容：
  - 表格去 `v<版本>` 占位（README.md:93-94）：

    | 包 | 适合 |
    |---|---|
    | arm64 版 APK | 绝大多数真机 |
    | x86_64 版 APK | 模拟器 / x86_64 设备 |

    链接统一指 `https://github.com/kelai141/dsh-mobile-apk/releases/latest`（latest 天然指向最新版）；完整文件名以 Release 页为准，README 不复述。
  - 补官方下载页入口：`https://kelai141.github.io/dsh-mobile-apk/`（Pages 部署，官方源与镜像加速源自动路由，下载直指 Releases 与加速镜像；来源 `release/v0.14.8/notes.md` §14 上线、`release/v0.14.9/notes.md` §14 改版）。对访问 GitHub 困难的中文用户，latest 直链恰恰不可靠，下载页是更稳的入口，紧随 latest 链接之后一行。
  - ABI 警示原样保留（README.md:100-101，node ELF 架构不符即崩，`AGENTS.md:203` 同证），写法软化为「装错包引擎启动即崩，请按设备类型选包」+ 出路「装错重装对应包即可」。
  - 渠道一致性提示（Termux 式，一句话）：应用自带应用内更新，请始终从同一渠道获取升级；跨渠道混装出问题时先完整卸载重装再反馈。
  - 覆盖安装提示保留（README.md:103）：覆盖升级保留会话与设置（ARCHITECTURE.md:58-59）；若触发快照刷新需 8-12 分钟，期间勿强杀（`AGENTS.md:204`）。首启解压与升级刷新是两件事——旧 README 首启写 2-4 分钟（README.md:32），升级刷新写 8-12 分钟（AGENTS.md:204），改版时分别表述，实施时以实测复核首启时长。
- 保留：README.md:87-103 全部事实点。

### 2.9 权限说明
- 目的：用户知情必需，逐项说用途。
- 内容：五行权限表保留（README.md:199-209），文字微调为用户语言（MANAGE_EXTERNAL_STORAGE → 「所有文件访问：使用外部工作区目录时需要，你在系统页手动授予」）；SAF 免权限与 Shizuku 前置说明保留。
- 保留：README.md:199-209 全部。

### 2.10 常见问题（FAQ）
- 目的：高频 3-5 问内嵌 + 末尾 issues/群链接（GKD「疑难解答」范式）。
- 条目（素材均现成）：
  1. 为什么必须给无障碍权限？（ARCHITECTURE.md:78、:173：AI 看屏与代操作的数据通道；不开则仅虚拟屏可用）
  2. 后台被杀怎么办？（电池白名单引导，ARCHITECTURE.md:73；进阶开 Shizuku）
  3. 应用出问题去哪反馈？（issues 附机型/版本/复现步骤，用户群二维码在文末；旧插件市场条目按拍板撤下，其反馈指引事实点改写至此）
  4. 模型 API 从哪来、怎么配？（在设置页的模型条目里直接选协议与思考档位。注意：「模型能力自动补齐」链路已随 0.14.8 整体退役——`release/v0.14.8/notes.md` §10：删掉插件本体与两个模型工具，模型面可见工具 6 降为 4。FAQ 不得把自动补齐写成现行为；changelog-archive.md:25 是 0.14.2 的旧能力条目，仅作历史沿革。）
  5. armv7l / 老机型什么时候支持？（如实答：待支持，README.md:232 既有诉求）
- 新增节，无旧对应。

### 2.11 面向开发者（指路）
- 目的：一行一段给链接，正文零展开。
- 内容：
  - 自己构建 → 协调仓 dsh-mobile README 与 `CONTRIBUTING.md`、`docs/AGENTS/build-and-env.md`（构建节 README.md:105-124 整体迁出，README 不再保留命令块）；
  - 桥协议 v1 → `docs/AGENTS/BRIDGE-API.md`（README.md:126-181 四张表迁出）；
  - 工具面（模型可见能力，不带工具数）→ `docs/AGENTS/modules.md`（或新建 TOOL-SURFACE.md，见迁移清单）；
  - 贡献 → `CONTRIBUTING.md`（README.md:211-213 压缩为一行）；
  - 版本历史 → `docs/AGENTS/changelog-archive.md`（README.md:215-218 保留为链接段——这是版本号的合规去处）。
- 保留：README.md:211-218 的链接本身。

### 2.12 致谢
- 目的：社区人情的收口。
- 内容：致谢名单保留（README.md:225-229，七人）；开发者招募需求清单（README.md:231-233）迁 `CONTRIBUTING.md`，此处留一句「想参与开发？见 CONTRIBUTING.md」。
- 拍板：生态四仓链接行（README.md:12）撤下，不进新 README。
- 保留：致谢名单；「诚邀开发者参与」迁出。

### 2.13 用户群
- 目的：社群入口，用户向 README 标配文末位。
- 内容：两码并排（README.md:237-238 现状排版即可）+ 一群满转二群说明（README.md:240-241）。
- 保留：README.md:235-241 全部。

### 2.14 支持我们
- 目的：自愿赞助与推广入口，文末。
- 内容：自愿前提声明 + 微信/支付宝两码（README.md:244-251）；两条第三方中转站推广链接（d1api.xin、aiapi.keniis.top，后者 2026-10-24 补拍板新增）并列放此节，均标注「第三方模型 API 中转站，非本开发者所属」，中英两版同步。消除英文版中英混排漂移（README.en.md:273-278）。
- 保留：README.md:244-251 全部。

### 2.15 License
- 目的：合规收口，惯例放最后。
- 内容：压缩为两句：MIT；GPL 合规三形态在场（快照 `usr/share/LICENSES/`、仓库 `LICENSES/`、APK `assets/licenses/`，README.md:220-223），并链接 `LICENSES/` 与 `THIRD_PARTY_NOTICES.md`。
- 保留：README.md:220-223 事实。

## 3. 功能卖点文案库

每条 = 可直抄的一句话文案 + 如实注意点（配套写法）+ 素材来源。重写 README 时照此取用，不自由发挥。注意点不全部上 README，按所在章节取舍，但不得删掉所列事实。

### 3.1 核心价值

**1. 内置 Linux 运行环境**（撤下：完整 Linux 运行环境属 0.15.0 规划，本轮不进 README；上线后按实测改写再启用）
- 文案：装好就有完整的 Linux 运行环境（node、git、bash、python 等常用工具链）和 AI 引擎，不用另装 Termux、不用配环境。
- 注意点：安装包约 150 MB 级，建议 Wi-Fi；首次启动要解压运行环境，请耐心等它完成、别强杀；必须装与本机 CPU 匹配的包（真机 arm64、模拟器 x86_64），装错引擎启动即崩。
- 来源：`dsh-mobile-apk/README.md:31-32`；体积 `release/v0.14.9/notes.md` 候选产物表（本轮核对：161,996,841 / 158,532,117 字节）；ABI 崩溃 `AGENTS.md:203`。

**2. AI 真实执行 bash（Termux 环境）**
- 文案：AI 跑的命令是真执行——内置 Termux 环境里是真实 bash。
- 注意点：命令作用于内置环境，误操作可能破坏运行环境，可用内置控制台排查或重新解压恢复；AI 对话需自行配置模型 API、需联网（权限表含 INTERNET，README.md:203）；「完整 Linux 运行环境」「完全离线」属 0.15.0，本轮不写。
- 来源：README.md:31-32（内嵌 Termux 运行时）、:41（内置控制台）、:203（INTERNET 权限）；ConsoleActivity/ConsoleSession `docs/AGENTS/ARCHITECTURE.md:64-65`。实施时以实测确认「AI 真实执行 bash」的用户面链路已通。

**3. 后台持续运行与自动恢复**
- 文案：切走应用、锁屏，AI 任务照跑；引擎出问题会自动探活并尝试恢复，手机重启后也能自动回到运行状态。
- 注意点：依赖前台服务，后台耗电高于普通应用，建议在应用引导下允许忽略电池优化；个别厂商激进省电策略可能仍需手动加白。
- 来源：ARCHITECTURE.md:54-56（EngineService/WatchdogV2）、:73（BootReceiver：BOOT_COMPLETED 恢复 + BatteryWhitelist 引导）、:140（manifest BootReceiver 行「开机恢复」）；BootReceiver.kt:32（`startForegroundService` 拉起 EngineService）。

**4. 应用内检查更新，升级保留数据**
- 文案：不用翻网页找安装包，应用内检查更新、下载校验后直接装；升级后会话、设置与插件配置都保留，环境更新全程按事务执行，失败自动回到上一个可用状态。
- 注意点：安装走系统安装器，需授予「允许安装未知应用」；只手动检查、不自动检查；触发快照刷新约需 8-12 分钟，期间不要强杀进程。
- 来源：changelog-archive.md:15（0.14.6 健康态入口 + APK 更新优先，已发布）；ARCHITECTURE.md:58-59、:121。多镜像/六档确认链等新交互（changelog-archive.md:7、EXECUTION-MAP.md:115）属 2026-10-22 重构，该条自述「未发版；未做设备验证」——用户文案先只写已发布事实（检查更新、下载校验、不自动检查）；要把确认链写进 README，先确认其已随版本发布。

### 3.2 设备控制（AI 的手和眼）

**5. AI 独立浏览器**（实验特性）
- 文案：AI 用一个独立浏览器窗口打开和操作网页，cookie 与登录状态和你的日常浏览器完全隔离，不碰你的账号。
- 注意点：受保护的站点来源会被拒绝访问；PC/手机身份切换的实际生效取决于 WebView provider 能力，结果在回执如实标注（未做设备验证）。
- 来源：ARCHITECTURE.md:26（BrowserHostProfile 按 Session 隔离）、:114（「是否实际生效依赖 provider 能力并在回执如实标注，未设备验证」）；changelog-archive.md:35（0.14.0 可用线）。

**6. 虚拟屏**（实验特性，需 Shizuku）
- 文案：AI 能在一块独立虚拟屏幕上启动并操作第三方 App，全程不占你正在用的屏幕，还能在浮窗里围观它操作。
- 注意点：需要先安装并授权 Shizuku。已 root 设备另有高级授权面，但「不装 Shizuku、仅 root 也能建虚拟屏」在来源中无证据（su 直连仅见 `release/v0.14.9/notes.md` §15 启动失败态的特权命令回退）——实施时先核实 root-only 建屏路径，拿不准就写「需 Shizuku；已 root 设备另有高级授权」。文档如实记录部分多屏能力仍在施工，实际可用项以应用内为准。
- 来源：README.md:53-66；ARCHITECTURE.md:105-107、:159-161（「本节记录代码施工状态，不表示已通过设备验收」——文案的「以应用内为准」正来自这句诚实约束）。

**7. AI 操作手机**
- 文案：开启无障碍授权后，AI 能看到屏幕内容并替你点击、滑动、输入、截屏，直接完成真实手机上的操作。
- 注意点：默认只允许 AI 操作虚拟屏；要动真实屏幕需要你在设置里主动放开屏幕范围，并具备相应授权档位。
- 来源：ARCHITECTURE.md:78、:173、:177；:150-156（范围门与权限档位）。

**8. 屏幕范围开关**
- 文案：AI 能碰哪些屏幕（仅虚拟屏 / 仅真实屏 / 全部）由你在设置里决定；配置损坏时自动退回最保守的「仅虚拟屏」。
- 注意点：允许操作真实屏幕时还要求会话具备完全访问档位；切换范围后 AI 手里的旧屏幕引用立即失效。
- 来源：ARCHITECTURE.md:27、:150-156。

**9. 通知栏应答与审批**
- 文案：AI 在后台遇到提问、审批会推到通知栏，直接在通知里回复、选选项、批准或拒绝，不用切回应用。
- 注意点：需要通知权限（Android 13 起手动允许）；无权限或投递异常时先本地保存、恢复后补投，通知可能延迟。
- 来源：ARCHITECTURE.md:80-84、:145；`release/v0.14.9/notes.md` §11（保存与补投）。

**10. 桌面悬浮球**
- 文案：桌面上有个小悬浮球实时显示 AI 进度；展开面板能直接回答 AI 的提问、看任务报告，三击状态行跳回应用；不想被打扰可一键隐藏，边缘点细条召回。
- 注意点：需要「显示在其他应用上层」权限（部分 ROM 默认关闭，应用内有引导）；跳回应用的手势是三击（不是单击），长按报告栏查看任务汇报；召回条很细，个别机型可能与系统边缘手势重叠；长期隐藏用设置页开关。
- 来源：ARCHITECTURE.md:36-44（:38 状态行手势「长按报告栏/三击跳转」）、:45；changelog-archive.md:33（0.14.1 块H：三击跳转 NEW_TASK|SINGLE_TOP 回 MainActivity）；`release/v0.14.9/notes.md` §5、§6（隐藏/召回、划任务不复活）。

**11. Shizuku 免 root 通道**
- 文案：不想 root 也能解锁高级设备控制：装一个 Shizuku 并授权，AI 就能建虚拟屏、执行特权操作。
- 注意点：需自行安装并启动 Shizuku（无线调试或 adb 激活）；部分联发科机型上 Shizuku 13.6.0 有已知启动失败问题，应用会给出诊断日志与降级到 13.5.4 或改用 ADB 通道的建议。
- 来源：ARCHITECTURE.md:100-101、:75；`release/v0.14.9/notes.md` §15。

**12. Root 高级授权**
- 文案：已 root 的设备可把更高权限授予 AI，并支持一键修复引擎文件属主问题；未 root 设备会明确提示不可用。
- 注意点：仅限已 root 设备；需勾选已阅读免责声明才生效，取消即撤销。
- 来源：ARCHITECTURE.md:102-104；changelog-archive.md:23。

**13. 手机控制授权中心**
- 文案：AI 的设备权限集中在一个设置页管理：无障碍、Shizuku、ADB 高级通道、root、屏幕范围，逐项可见状态、出问题有诊断。
- 注意点：各项仍需在系统侧完成授权；ADB 通道为迁移面，正式通道是 Shizuku。实施时统一名称：README 写「手机控制」，ARCHITECTURE.md:177 写「设备控制授权」，以应用内设置页实际文案为准。
- 来源：ARCHITECTURE.md:177、:169。

### 3.3 文件与输入

**14. 任意应用分享文件给 AI**
- 文案：在任何应用里点「分享 / 打开」，就能把文件交给 AI 处理；来件先做安全净化，再进入会话变成附件草稿。
- 注意点：未领取的来件与草稿按保留策略超期回收；投递需要应用在运行。
- 来源：ARCHITECTURE.md:24（FileIncoming）；README.md:83-84（7 天 TTL）。

**15. 聊天附件入口**
- 文案：聊天里点回形针直接出菜单：传图片走相册、传文件走文件选择器，一步到位。
- 注意点：相册分流只对显式图片类型生效；选择器形态取决于系统应用。
- 来源：changelog-archive.md:35（0.14.0 #215）；README.md:80-82。

**16. AI 产物保存与打开**
- 文案：AI 生成的图片、文件能直接存到手机，也能用系统「打开方式」交给其他应用或分享出去。
- 注意点：凭据等机密文件被排除在可分享范围外。
- 来源：ARCHITECTURE.md:22（DownloadSaver）、:88（PathOpen）、:142（白名单排除机密）。

**17. AI 中文输入**
- 文案：内置专用输入法，AI 往输入框打中文不丢字——这是普通 ADB 输入做不到的。
- 注意点：需把设备输入法切换为内置 ADB 键盘并绑定目标输入框；失败会给出可操作提示，不假装成功。
- 来源：ARCHITECTURE.md:71-72；`release/v0.14.9/notes.md` §10。

### 3.4 稳定性与自愈

**18. 插件故障自愈**
- 文案：装坏的插件把页面搞挂时，应用会自动定位并摘除问题插件、重启引擎，几十秒内自行恢复。
- 注意点：被自动摘除的插件保持停用，需你确认后再启用。
- 来源：changelog-archive.md:19（2026-10-05 设备实测 45s 自愈）；ARCHITECTURE.md:56、:125。

**19. 安全模式**
- 文案：环境被改坏、引擎反复起不来时，用「安全模式启动」以最小可用配置进入应用，再修复或还原。
- 注意点：还原时若恢复副本校验失败会拒绝写回——宁可不恢复也不写坏文件。
- 来源：EXECUTION-MAP.md:70；ARCHITECTURE.md:126。

**20. 启动诊断与脱敏诊断包**
- 文案：启动失败时错误原因分阶段说清楚，还能一键把脱敏诊断包通过系统分享发给帮你排查的人。
- 注意点：诊断包必须你主动点击才会发出，不会自动上传；建议发送前自行确认内容。
- 来源：changelog-archive.md:15（0.14.6）；ARCHITECTURE.md:18、:86。

**21. 启动失败修复助手**
- 文案：引擎启动失败会先自动重试，仍失败时进入内置修复助手，读取本轮诊断并实际修复，而不是只留一个报错。
- 注意点：助手工作受验证范围限制，遇到修复不了的情形仍可走脱敏诊断包 + 社区反馈。（README 不写版本号，也不复述 notes 的「仅在模拟器快速验证」细节，但文案不得宣称「万能修复」。）
- 来源：`release/v0.14.9/notes.md` §3；notes 已知限制第 1 条。

**22. 大小内存都照顾**
- 文案：大内存手机上引擎可用内存上限按设备实际内存成倍放宽，重任务更从容；小内存手机也有启动兜底，降低因内存过小起不来的概率。
- 注意点：上限是天花板而非预分配，只在真需要时增长。
- 来源：`release/v0.14.9/notes.md` §9（表格 512/1024/2048/3072/4096）；`release/v0.14.8/notes.md` §1。

### 3.5 界面与体验

**23. 双工作区分屏与悬浮小窗**
- 文案：右侧边栏可同时开两个工作区：竖屏上下分、横屏左右分，可拖比例、可对调，还能缩成悬浮小窗边用边看。
- 注意点：浏览器与虚拟屏按能力限制组合。
- 来源：`release/v0.14.9/notes.md` §7。

**24. 界面语言与外观**
- 文案：界面可切中文、英文或跟随系统，重启后保持；深浅色跟随系统，可选屏幕常亮与沉浸式全屏。
- 注意点：屏幕常亮为可选项，开启增加耗电。
- 来源：`release/v0.14.9/notes.md` §1；ARCHITECTURE.md:23、:40。

**25. 手机端细节打磨（合并条）**
- 文案：窄屏多任务收成竖向气泡不占地方，侧栏抽屉手势逐帧跟手、收起不卡顿，宽表格横滑浏览——大量手机形态细节持续打磨。
- 注意点：部分改进仅手机形态生效，桌面/横屏行为不变。
- 来源：`release/v0.14.8/notes.md` §9、§12；`release/v0.14.7/notes.md` §1、§12；`release/v0.14.9/notes.md` §8。

**26. 内置终端控制台**（待核实：终端可用性依赖运行环境现状，完整 Linux 环境属 0.15.0；实施时按实测决定进退或降格措辞）
- 文案：应用里自带命令行终端，引擎没启动也能打开，随时检查和修复运行环境。
- 注意点：命令直接作用于内置环境，误操作可能破坏引擎，届时重新解压快照可恢复。
- 来源：ARCHITECTURE.md:64-65、:134（「引擎未运行也可用」）。

**27. 插件与插件市场（如实定位）**（撤下：拍板 2026-10-24，插件市场整体不进新 README，本条留档备查）
- 文案：内置插件市场提供第三方插件分发（beta）；AI 可见的能力全部来自插件，插件坏掉有自愈兜底。
- 注意点：绝大多数第三方插件在手机端尚不可用、大概率有 bug；beta 阶段只做可用性验证与反馈，暂不建议当生产依赖；报错到 issues 附机型/版本/复现步骤。引擎未启动也能管理普通插件（0.14.9 notes §4，核心内置插件除外）。
- 来源：README.md:22-25；`AGENTS.md:14`（「AI 可见的能力全部来自插件」唯一出处，本轮 grep 证实 ARCHITECTURE.md 无此句）；`release/v0.14.9/notes.md` §4。

## 4. 旧内容迁移清单

逐项处置。承接文件均已核实存在：`dsh-mobile-apk/CONTRIBUTING.md`、`CONTRIBUTING.en.md`、`docs/AGENTS/BRIDGE-API.md`、`docs/AGENTS/changelog-archive.md`、`docs/AGENTS/ARCHITECTURE.md`、`docs/AGENTS/ACCESSIBILITY-API.md`、`docs/AGENTS/build-and-env.md`、`docs/AGENTS/modules.md`、`LICENSES/`、`THIRD_PARTY_NOTICES.md`、`qrcode/` 四图（本轮 ls 核对）。

| 旧位置 | 内容 | 处置 | 去处 / 承接 | 说明 |
|---|---|---|---|---|
| README.md:5-6 | QQ 群/QQ2群 徽章 | 留 | 新 badge 行末位 | must-carry-over |
| README.md:7-10 | DeepSeek Harness/Android/Cloudflare 装饰徽章 | 撤或移 | 文末致谢节可选保留 | 不承载用户决策信息 |
| README.md:12 | 生态四仓链接行 | 撤（拍板） | — | 生态行不要，不进新 README |
| README.md:13 | d1api.xin 推广链接 | 留（下移，拍板） | 支持我们节 | 如实标注性质；两版必须同步 |
| README.md:15-17 | 项目简介 | 留（压缩为定位句） | 首屏 | |
| README.md:19 | 应用名/包名 | 留 | 首屏一行 | |
| README.md:20 | 当前版本 0.14.6/versionCode 50/引擎版本 | 摘 | 版本信息归 Releases 页 | 已过期实锤（见 §0.1） |
| README.md:22-25 | 插件市场警示块 | 撤（拍板） | — | 插件市场整体不进 README；报错反馈指引事实点并入 FAQ「出问题去哪反馈」 |
| README.md:27-85 用户视角句 | 功能卖点 | 留（改写） | 核心特性节 | 按第 3 章文案库取用 |
| README.md:57-59、72-75 等 | 实现细节（跨屏拉起唯一路径、guard()、ref 寻址） | 迁 | `docs/AGENTS/ARCHITECTURE.md` / `docs/AGENTS/ACCESSIBILITY-API.md` | 详档已是权威；迁移时核对是否有缺口，缺则补进详档 |
| README.md:87-103 | 下载表 + ABI 警示 + adb install + 覆盖安装提示 | 留（去版本占位） | 下载与安装节 | `v<版本>` 改「最新版」+ latest 链接 |
| README.md:105-124 | 构建节 | 迁 | 协调仓 dsh-mobile README / `CONTRIBUTING.md` / `docs/AGENTS/build-and-env.md` | README 留一段「自己构建」指路；compileSdk/Gradle 版本随节迁出 |
| README.md:126-181 | 桥协议 v1 四张表 | 迁 | `docs/AGENTS/BRIDGE-API.md` | 该文件已存在且被 AGENTS.md 路由表列为权威；迁移 PR 先核对其是否已含 51 方法全表，缺则并入，避免双源 |
| README.md:183-197 | 工具面 45 工具清单 | 迁 | 首选 `docs/AGENTS/modules.md`（实施时先核对其范围是否覆盖工具面；不覆盖则新建 `docs/AGENTS/TOOL-SURFACE.md`） | 其中 model-capability（2）已随 0.14.8 整体退役（`release/v0.14.8/notes.md` §10），迁移时不得把退役工具与「45」这个旧计数搬进承接文档，工具清单以当前代码为准 |
| README.md:199-209 | 权限表 | 留 | 权限说明节 | |
| README.md:211-213 | 贡献指路 | 留（压缩） | 面向开发者节 | |
| README.md:215-218 | 版本历史链接 | 留（压缩） | 面向开发者节 | changelog-archive.md 是版本号的合规承载地 |
| README.md:220-223 | License + GPL 三形态 | 留（压缩） | License 节 | 补链 `LICENSES/` 与 `THIRD_PARTY_NOTICES.md` |
| README.md:225-229 | 致谢名单（七人） | 留 | 致谢节 | must-carry-over |
| README.md:231-233 | 开发者招募与需求清单 | 迁 | `CONTRIBUTING.md` | README 留一句指路 |
| README.md:235-241 | 用户群二维码与说明 | 留 | 用户群节 | must-carry-over |
| README.md:244-251 | 赞赏码/支持我们 | 留 | 支持我们节（文末） | must-carry-over |
| README.md:32、137 等 | `127.0.0.1:3080` 端口等实现细节 | 迁/删 | 随所属节迁详档 | 用户面 README 无需端口 |
| README.zh.md | 跳转壳（8 行，`wc -l README.zh.md` = 8，本轮实测） | 撤（拍板：删除文件） | — | 旧外链 404 已接受 |
| README.en.md | 英文全量镜像 | 留（改写同步） | 与新 README.md 同 PR 重写 | 同步规则见 §5.3 |

## 5. 版本号与发版联动方案

### 5.1 摘除清单（改版时逐处过）
按脚本统计 + 本轮逐行核对，需摘除或改写的版本表述：
- `README.md:20` / `README.en.md:18`：当前源码版本 0.14.6、versionCode 50、引擎 0.2.0-rc.2——整句摘除，版本信息归 Releases 页。
- `README.md:33` / `README.en.md:34`：「APK 自更新（0.14.6 起为用户面主路径）」——去掉括号，改为「应用内检查更新」。
- `README.md:39` / `README.en.md:44-45`：「0.14.6 起用户面入口已切到……」——历史沿革句，用户面无意义，摘除（沿革归 changelog-archive.md）。
- `README.md:93-94、121` / `README.en.md:117-118、147`：`v<版本>` 占位——改「最新版」表述（见 §2.8 表格写法）。
- `README.md:108` / `README.en.md:134`：compileSdk 36 / Gradle 8.11.1——随构建节迁出。
- `127.0.0.1:3080`（README.md:32、137；en:33、163）：随实现细节迁详档。
- **保留类**（不是产品版本号，不摘）：Android 13+/API 33+/Android 8.0（平台限定，改用户语言）；WebView 110（稳定事实，随 AI 浏览器文案可留可去）；文件名中出现的版本号只在 Release 页出现，README 不复述。

### 5.2 常青机制（以后发版不动 README）
1. **版本信息只有一个家**：GitHub Releases 页（latest 链接）+ `docs/AGENTS/changelog-archive.md` + `release/v<版本>/notes.md`。README 永不写「当前版本」。
2. **能力表述用状态不用日期**：「现已支持」「需要开启」，禁「X.Y.Z 起支持」。
3. **下载引导只挂 latest 链接**：`https://github.com/kelai141/dsh-mobile-apk/releases/latest` 天然跟随最新版；文件名细节让 Release 页承载。
4. **PR 联动规则（写进 CONTRIBUTING.md 一行）**：新增或移除用户可见功能的 PR，必须同步更新 README 特性节与 FAQ（中英）；纯发版（notes 上传、tag）不需要碰 README。
5. **常青门禁：拍板不做（2026-10-24）**——约定即「以后一律不写版本号」，不设常驻门禁；PR-B 交付时按 §8.3-2 的验收 grep 把关一次。

### 5.3 三份文件取舍
- **README.md**：唯一权威中文全文，仓库首页，宣发主面。
- **README.en.md**：保留，逐节对应翻译，**与中文版同一 PR 内同步改写**（铁律 7 本就要求中文或双语，正好约束）。两文件头部各加一行 HTML 注释：「本文件与另一语言版本逐节对应，改动请在同一 PR 内双语同步」。改版时必须消除三处既有漂移：d1api.xin 仅中文版（README.md:13 vs en:10）、「支持我们」英文版中英混排（en:273-278）、版本号两版同过期（md:20 vs en:18）。
- **README.zh.md**：拍板删除（2026-10-24）。旧外链指向该文件的会 404，已接受；互链只保留中英两版。

## 6. 视觉与双语建议

### 6.1 badge 行（4-6 个）
顺序建议：`License MIT` → `Release（latest）` → `Android 8.0+` → `English README`（或保留首行文字互链）→ `QQ 群`（末位）。
- shields.io 静态 badge 即可，无需外部动态服务；Release badge 用 GitHub 官方 badge（`https://img.shields.io/github/v/release/kelai141/dsh-mobile-apk`），随最新版自动更新，天然常青。
- CI badge：apk 仓已有公开 workflow（本轮 `ls .github/workflows` 实证：build-apk.yml、build-apk-source.yml、pages.yml、pr-gate.yml、release.yml），技术上可挂——拍板暂不挂。
- badge 属视觉元素，不在「禁 emoji」范围；badge 文字本身不用 emoji 字符。

### 6.2 截图与 GIF
- 2x2 截图表格放「界面速览」节；候选画面：主界面与对话、右侧分栏双工作区（0.14.9 §7）、虚拟屏浮窗、通知栏应答或悬浮球。
- 首屏 320 宽 GIF（10-20 秒「一句话 → agent 真实执行 bash → 返回结果」）为加分项，可后补；演示以当前版本实测为准，不演示 0.15.0 的完整工具链能力。
- 素材来源：模拟器验收截图（`docs/AGENTS/emulator-test-protocol.md` 真实任务截图是验收副产品）；采图用模拟器（L0 文档改动不强制设备验证，采图属素材采集）。截图旁可加一句「截图来自真实任务运行」作信任点。

### 6.3 二维码与运营元素排布
- 用户群两码：维持 `width=320` 并排（README.md:237-238 现状即可），放「用户群」节。
- 赞赏码两图：文末「支持我们」节，自愿前提声明保留原句。
- 推广链接 d1api.xin（拍板保留）：放「支持我们」节并如实标注性质；不进首屏。

### 6.4 双语策略
- 中文版为权威源；英文版逐节同构，同 PR 同步，改版 PR 内一次重写到位。
- 英文版不是机翻：桥协议等已迁出的节无需翻译；两版只对齐用户面章节。
- 首行互链保留双向（md ↔ en）。

### 6.5 emoji 边界
- 现行规范（AGENTS.md 铁律 8）禁 emoji，README 属文档。现状 `README.md:3` 与 `README.en.md:3` 的「🌐」字符属违规现状，拍板：改纯文字互链（emoji 不放开）。
- badge、二维码等图片元素不受限。

## 7. 决议记录（2026-10-24 用户拍板，开放问题全部收口）

| # | 问题 | 决议 |
|---|---|---|
| 1 | emoji 是否放开 | 不放开，维持禁 emoji；首行「🌐」改纯文字互链；badge/二维码图片不受限 |
| 2 | 推广链接去留 | 保留并列两条（d1api.xin；aiapi.keniis.top 为 2026-10-24 补拍板新增）：移出首屏，放文末「支持我们」节，均标注「第三方模型 API 中转站，非本开发者所属」，中英两版同步 |
| 3 | README.zh.md 去留 | 删除；旧外链 404 已接受 |
| 4 | 英文版维护模式 | 全量逐节镜像，与中文版同一 PR 同步改写 |
| 5 | 插件市场内容 | 整体不进新 README（卖点、首屏警示、FAQ 条目均撤）；beta 定位由应用内提示承载 |
| 6 | CI badge | 暂不挂（以后需要再议） |
| 7 | 版本号常青门禁 | 不做门禁；约定即「以后一律不写版本号」，PR-B 按 §8.3-2 验收 grep 把关一次 |
| 8 | 首启解压时长表述 | 同意推荐表述：首次启动或升级后可能需几分钟到十余分钟，期间勿强杀；实施时实测复核 |

拍板同时新增两条决定：

- **生态四仓链接行撤下**，不进新 README（§2.12）。
- **运行环境口径**：bash 已内置（Termux bash），可如实宣传；「完整 Linux 运行环境」属 0.15.0 规划，本轮不写工具链清单、不写「完全离线」（§1、§2.3、§2.5、卖点 1/2）。实施时以实测确认「AI 真实执行 bash」的用户面链路，若链路未通则同步撤下相关表述。

## 8. 实施步骤与验收口径

### 8.1 PR 拆分（原子化交付，铁律 3）
1. **PR-A 迁移先行（防断链）**：桥协议四张表并入 `docs/AGENTS/BRIDGE-API.md`（先核对缺口）；工具面清单迁 `docs/AGENTS/modules.md` 或新建 TOOL-SURFACE.md；构建节内容确认协调仓 README/`build-and-env.md` 已覆盖、缺则补；`CONTRIBUTING.md` 增补开发者招募需求清单（中英两份 CONTRIBUTING 同步）。此 PR 不动 README 正文，README 旧链接暂不删——迁移完成后再改写。
2. **PR-B README 重写**：按本方案第 2 章大纲与第 3 章文案库重写 `README.md` + `README.en.md`（同一 PR），消除三处漂移，摘除全部产品版本号；随 PR 采模拟器截图 4 张（或先留占位注释）。
3. ~~PR-C 常青门禁~~：拍板不做（见 §7 决议 7），仅保留 PR-B 内的一次性验收 grep。

### 8.2 步骤清单（PR-B 展开后）
1. 逐项执行第 4 章迁移清单（25 行逐行核销：「留」类 14 行——其中标注 must-carry-over 的 4 行〔QQ 徽章、致谢、用户群、赞赏码〕；「迁」6 行；「撤/摘」5 行〔装饰徽章撤或移、生态行撤、插件警示块撤、版本号摘、README.zh.md 删〕——均含 2026-10-24 拍板结果）。
2. 按第 3 章文案库填充特性与 FAQ，每条核对来源映射。
3. 执行 5.1 摘除清单，grep 复核（见 8.3-2）。
4. 截图已就位（2026-10-24 用户提供真机实拍 8 张，选用 4 张存 `docs/images/`：主界面对话 ui-home、分栏小窗 ui-split、通知栏 ui-notification、侧栏 ui-drawer；启动诊断页一张因含应用内版本徽章 v0.14.9，按常青原则未选用；GIF 可后补）。
5. 英文版逐节对齐 + 漂移消除。
6. 双文件头部加双语同步维护注释。
7. 开 PR：标题与描述中文、无 emoji（铁律 7/8）；PR-A/PR-B 标注「未做设备验证」（纯文档与素材采集，L0 档 CI 绿即可，铁律 2/3）。

### 8.3 验收口径（怎么算改好了）
1. **迁移验收**：第 4 章清单逐项核销；`docs/AGENTS/BRIDGE-API.md` 收编四张表后与旧 README:126-181 内容等价（51 方法无遗漏）。
2. **版本号验收**（本轮预演命令，改版后必须零命中产品版本）：
   `grep -nE "0\.1[0-9]\.[0-9]|versionCode|0\.2\.[0-9]-rc" dsh-mobile-apk/README.md dsh-mobile-apk/README.en.md`
   预期：无输出（changelog-archive.md 等承接文件不受限）。
3. **链接验收**：README 内相对链接全可达——`README.en.md`、`docs/AGENTS/BRIDGE-API.md`、`docs/AGENTS/changelog-archive.md`、`CONTRIBUTING.md`、`qrcode/qqcommunity-1.png`、`qrcode/qqcommunity-2.png`、`qrcode/support-wechat.png`、`qrcode/support-alipay.png`、`LICENSES/`；`releases/latest` 外链可解析；官方下载页 `https://kelai141.github.io/dsh-mobile-apk/` 在线可达（Pages 部署，随发布链自动刷新）。
4. **双语验收**：`README.md` 与 `README.en.md` 章节标题一一对应；英文版无 d1api 漂移、无中英混排残留。
5. **夸大审查**：特性节每条卖点能在第 3 章文案库找到对应条目与来源；所有「需 Shizuku / 需无障碍 / 需通知权限 / 需联网并自配模型 API / 解压等待 / ABI 匹配 / 允许安装未知应用」前置条件句在场；文中不得出现「完整 Linux 运行环境」「完全离线」等 0.15.0 未上线表述，bash 表述须带 Termux 环境限定。
6. **首屏验收**：第一屏（标题至免责）无版本号、无构建命令、无推广链接；只回答「它是什么 + 去哪下」。
7. **流程验收**：PR 描述中文且无 emoji；PR-A 与 PR-B 分开提交、各自可独立 revert。

### 8.4 本轮已核对 / 未核实事项声明
- 已核对：`README.md` 全文（251 行）、`README.zh.md` 全文（8 行，wc -l 实测）、`README.en.md` 头部与尾部、协调仓 `release/v0.14.9/notes.md` §1-§17 与候选产物表、`release/v0.14.8/notes.md` §10（模型补齐插件退役）与 §14（下载页上线）、`dsh-mobile-apk/AGENTS.md` 相关行、`docs/AGENTS/ARCHITECTURE.md` 相关行（:38、:73、:114、:140、:159-161）、`docs/AGENTS/changelog-archive.md` 相关行（:7、:15、:25、:33、:35）、`BootReceiver.kt:32`、目录结构（CONTRIBUTING/LICENSES/qrcode/docs/AGENTS 文件在场均本轮 ls 实证）、`ls .github/workflows`（5 个公开 workflow）、`grep -n "实验" README.md`（零命中）、`grep -n "能力全部来自插件"`（仅 AGENTS.md:14）。
- 未核实（实施时补）：`docs/AGENTS/modules.md` 的内容范围是否覆盖工具面；`docs/AGENTS/BRIDGE-API.md` 与 README 四张表的等价性需打开该文件逐表核对；首启解压时长实测；root-only 建屏路径是否存在（卖点 6）；多镜像/六档确认链是否已随版本发布（卖点 4）；卖点 26 内置终端在当前版本的实际可用形态；「AI 真实执行 bash」的用户面链路实测。
- 拍板补充（2026-10-24）：bash 已内置（Termux bash），可写；「完整 Linux 运行环境」为 0.15.0 交付，本轮不写工具链清单与「完全离线」，0.15.0 上线时按实测补写卖点 1。

## 附录：第 1 轮评审意见消化记录（2026-10-24）

| # | 评审意见 | 处置 |
|---|---|---|
| 1 | FAQ 4 把已退役的「模型信息自动补齐」当现成素材（high） | 采纳：§2.10 FAQ 4 改现况表述（设置页模型条目直接选，链路已退役）；§4 工具面行标注 model-capability（2）已删、工具数以当前代码为准。证据复核：`release/v0.14.8/notes.md` §10。 |
| 2 | 「README.md:18 既有惯例——实验特性标注」为不实断言（medium） | 采纳：删「既有惯例」说法，改为本次改版新立的规则并注明 grep 零命中；出处改引 ARCHITECTURE.md:159-161。复核命令：`grep -n "实验" dsh-mobile-apk/README.md`，exit=1。 |
| 3 | 悬浮球「点一下跳回应用」与三击手势不符（medium） | 采纳：文案改「三击状态行跳回应用」，注意点补「长按报告栏查看任务汇报」。复核：ARCHITECTURE.md:38、changelog-archive.md:33。 |
| 4 | 「完全离线」升格头条未限定范围（medium） | 采纳：统一改「运行环境完全离线（工具链内置、代码与数据留在本机）」，注意点补「AI 对话需自行配置模型 API、需联网（README.md:203 INTERNET）」；§2.5 条目 1 与卖点 2 两处同改。 |
| 5 | 下载引导漏掉官方下载页（medium） | 采纳：§2.8 补下载页入口（官方源与镜像加速自动路由），§8.3-3 链接验收纳入该 URL。证据复核：`release/v0.14.8/notes.md` §14（上线）、`release/v0.14.9/notes.md` §14（改版）。 |
| 6 | 卖点 5 注意点改写来源事实（low） | 采纳：按 ARCHITECTURE.md:114 原文改写——「实际生效取决于 WebView provider 能力，结果在回执如实标注（未做设备验证）」，删「目标网站检测能力」的错误转述。 |
| 7 | 两处出处指错 / 行号不支撑（low） | 采纳：卖点 27 来源改指 `AGENTS.md:14`（grep 证实 ARCHITECTURE.md 无该句）；卖点 3 出处改 ARCHITECTURE.md:73 与 :140 + `BootReceiver.kt:32`，删不支撑的 :135。 |
| 8 | README.zh.md 行数与 workflow 现状两处小错漏（low） | 采纳：跳转壳改「8 行」（`wc -l README.zh.md` = 8）；开放问题 6 事实前提更新为「已有 5 个公开 workflow」，推荐仍先不挂。 |
| 9 | 卖点 4 引用「未发版；未做设备验证」的重构记录（low） | 采纳：来源补注该重构未发版（changelog-archive.md:7 自述），用户文案先只写已发布事实；确认链写进 README 前需确认已随版本发布；未核实清单新增此项。 |
| 10 | 「虚拟屏（需 Shizuku 或 root）」root 表述可能被读宽（low） | 采纳：改「需 Shizuku」；root 仅表述为「已 root 设备另有高级授权」；「仅 root 即可建虚拟屏」无来源证据，root-only 建屏路径列入实施前核实项。 |

十条全部采纳，无保留意见；八个章节结构未变。

## 附录 B：第 2 轮评审遗留处置（2026-10-24，主线收口）

第 2 轮评审遗留 4 条 low 级备注（中高危已在前一轮消化），本轮逐条修毕：

| # | 评审意见 | 处置 |
|---|---|---|
| 1 | 卖点 4 文案「设置里检查更新」超前描述了未发版重构后的入口形态，违反「用户文案先只写已发布事实」自规（low） | 采纳：改「应用内检查更新」（与 §5.1 措辞一致）；「设置页一级分区」待提级版发布后再写。证据：`git grep "开发者选项" v0.14.9 -- app/src/main/java` 显示已发布版入口在设置 > 开发者选项（AndroidBridge.kt:612 等）；changelog-archive.md:7 自述提级重构「未发版；未做设备验证」。 |
| 2 | §2.11 新 README 指路行残留「45 工具」过期计数，与第 4 章迁移清单自己的禁令矛盾（low） | 采纳：改「工具面（模型可见能力，不带工具数）」，计数交承接文档按当前代码现数。证据：`release/v0.14.8/notes.md` §10（模型面 6→4）。 |
| 3 | §8.2-1「18 项 must-carry-over」计数与第 4 章清单对不上，实施勾选会困惑或漏勾（low） | 采纳：改为准确口径——清单 25 行逐行核销：「留」类 16 行（其中标注 must-carry-over 的 4 行、另 §2.4 插件警示块 1 处，合计 5 处）、「迁」6 行、其余为撤/摘/待拍板。证据：本轮逐行清点 §4 表。 |
| 4 | §8.3-5 夸大审查的前置条件枚举是封闭列表，漏掉修订新增的两条前置，验收会漏查（low） | 采纳：枚举补「需联网并自配模型 API（完全离线仅指运行环境）」与「允许安装未知应用」。 |
