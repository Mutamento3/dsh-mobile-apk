# dsh-session-delete

给会话行「…」菜单加一个 **删除对话**。引擎目前只有归档（issue #493），没有真正的删除；本插件补上。

## 组成

- **src/client.js**：两处注册
  - `sidebar.workspaces.session.menu.item`：「删除对话」（danger，order 500）。菜单项只记录目标——
    选中会关闭菜单并卸载菜单项，确认框若挂在这里根本不会出现；
  - `shell.overlay`：确认框本体（自绘 Modal，不用 `window.confirm`——壳侧会自动批准 JS 弹窗）。
    确认后 `POST /api/session-delete`，成功关闭弹窗并把该行隐藏。
  - **幂等**：只有带 `error: 'not-found'` 的 404 才算「已删」；宿主插件没加载时的 404 会正常报错。
  - **不做导航**：live 会话在 host 侧已被拒绝，所以删掉的一定不是屏幕上正在显示的那条，
    客户端不需要切页（也就不会碰 `clearMain` 这类 private 接口）。
- **src/index.js**（host）：注册三个路由（日志走 stdout 的 `[dsh-session-delete]` 前缀——
  `ctx.logger.info` 在 Android 壳里不落 `engine.log`，实测不可见）
  - `POST /api/session-delete`：`connection.requestRejection(req)` 同源鉴权；只接受 `session-<uuid>`；
    请求体上限 4 KB；
  - 拒绝规则（全部 409）：
    - `workspace/session-activity` 瀑布报告有活动 → `session-active`；
    - **探测状态未知**（provider 抛错 / 返回非数组 / 老引擎没有瀑布）→ `activity-unknown`，
      绝不把「不知道」当「空闲」；
    - **会话仍加载在引擎里** → `session-loaded`：引擎没有任何公开接口能卸载内存会话
      （`flush(session)` 要求会话仍在 live store、`liveEntryFor` 是 private、
      `AgentHandle.dispose()` 只暴露给创建者），只删磁盘会留下「文件没了但内存里还在」的
      幽灵会话、继续参与搜索。重启应用后 live 集合清空即可删除；
  - 删除前 best-effort 调用 `workspaceRegistry.unarchiveSession/unpinSession`（失败只记日志）。
  - `POST /api/session-delete-trace`：客户端决策回传（写 engine.log，便于现场取证）。
  - `GET /api/session-delete-version`：构建戳，供页面自更新。
- **src/session-delete.js**：可单测的删除核心——定位 `<DSH_HOME>/sessions/<cwd-key>/<id>/`，
  命中 0 个报 `not-found`、命中 2 个报 `ambiguous`（一个都不删），先 `rename` 成 `.deleting-<t>`
  再递归删除，避免并发扫描看到删到一半的目录。

## 构建与安装

源码在 `src/`，`node build.mjs` 把 `src/**` 复制成 `lib/**`——快照注入只带 `lib/**` + `package.json`
（见 `scripts/inject-all.py` 的 `build_dsh_replacements`），所以 `lib/client.js` 必须存在。
`lib/` 是构建产物，不进 git。

启用：`scripts/profile-web.cordis.patch.yml` 里 `- id: session-delete` 的 insert（插件本身不带
`dsh.bundle.patch`，与仓库其它 `@dsh-android/*` 插件同一形态）。

## 验证

- `node plugins/dsh-session-delete/test/session-delete.test.mjs`：**20 项全过**
  （非法 id / 不存在 / 运行中拒绝 / live 拒绝 / 正常删除 + 记账顺序 / 重复命中不删 / 目录定位 /
  host 编排拒绝 / 归档置顶清理顺序 / 每步日志 / 探测抛错与非数组拒绝 / 无瀑布拒绝 /
  目录中途消失→not-found / post-rename 钩子失败不残留 / 接口契约：不出现 flush、liveEntryFor、
  clearMain、shortcuts.find）。
- `node scripts/check-api-route-auth.mjs`：三道路由均登记为 protected。
- `node scripts/check-code-map.mjs`：新增文件已进覆盖账本。

## 边界

- 删除不可恢复；只删磁盘上的会话目录，不碰工作区本身。
- live 会话需要先重启应用再删（见上）。
- 归档/置顶集合的清理是 best-effort：失败只记日志，不阻断删除。
