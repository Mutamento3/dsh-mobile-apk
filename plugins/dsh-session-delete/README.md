# dsh-session-delete

给会话行「…」菜单加一个 **删除对话**。引擎目前只有归档（issue #493），没有真正的删除；本插件补上。

## 组成

- **client.js**：两处注册
  - `sidebar.workspaces.session.menu.item`：「删除对话」（danger，order 500）。菜单项只记录目标——
    选中会关闭菜单并卸载菜单项，确认框若挂在这里根本不会出现；
  - `shell.overlay`：确认框本体（自绘 Modal，不用 `window.confirm`——壳侧会自动批准 JS 弹窗）。
    确认后 `POST /api/session-delete`，成功 `location.reload()` 让列表/索引/搜索重读。
  - **幂等**：host 返回 404（会话已删/引擎已重启）时按成功处理，不再弹「session not found」。
  - **删的是当前打开的会话**：不重载（重载会恢复到那条已删的会话），改为点应用自己的
    「新会话」控件切到新对话；找不到控件时回退为重载。
  - **隐藏已删行**：引擎把加载过的会话留在内存里直到下次启动，所以删掉的行还会出现一会儿。
    client 把已删 id 记进 `localStorage['dsh.session-delete.hidden']`（上限 200），
    下次加载注入 `[data-row-key="session:<id>"]{display:none}`；引擎重启后列表本就干净，条目无副作用。
- **src/index.js**（host）：注册 `POST /api/session-delete`（日志走 stdout 的 `[dsh-session-delete]`
  前缀——`ctx.logger.info` 在 Android 壳里不落 `engine.log`，实测不可见）
  - 走 `connection.requestRejection(req)` 同源鉴权；
  - 只接受 `session-<uuid>`；请求体上限 4 KB；
  - 拦截判据是「正在运行」而不是「加载过」：引擎把打开过的会话都留在内存里，所以用
    `workspace/session-activity` 瀑布（与上游归档同一判据）判断，有活动才 **409**；
    加载但空闲的会话允许删除（删后到下次引擎启动才从 live 列表消失）；
  - 删除前 best-effort 调用 `workspaceRegistry.unarchiveSession/unpinSession`，清掉归档/置顶成员关系。
- **src/session-delete.js**：可单测的删除核心——定位 `<DSH_HOME>/sessions/<cwd-key>/<id>/`，
  命中 0 个报 `not-found`、命中 2 个报 `ambiguous`（一个都不删），先 `rename` 成 `.deleting-<t>` 再递归删除，
  避免并发扫描看到删到一半的目录。

## 构建与安装

源码在 `src/`，`node build.mjs` 把 `src/**` 复制成 `lib/**`——快照注入只带 `lib/**` + `package.json`
（见 `scripts/inject-all.py` 的 `build_dsh_replacements`），所以 `lib/client.js` 必须存在。
`lib/` 是构建产物，不进 git。

启用：`scripts/profile-web.cordis.patch.yml` 里 `- id: session-delete` 的 insert（插件本身不再带
`dsh.bundle.patch`，与仓库其它 `@dsh-android/*` 插件同一形态）。

## 验证

- `node plugins/dsh-session-delete/test/session-delete.test.mjs`：**8 项全过**
  （非法 id / 不存在 / 活会话拒绝 / 正常删除 + 记账顺序 / 重复命中不删 / 目录定位 /
  host 编排的活会话拒绝 / 归档置顶清理顺序）。
- `node scripts/check-api-route-auth.mjs`：通过（`/api/session-delete` 已登记为 protected，guard 在注册块内）。
- `node scripts/check-code-map.mjs`：通过（新增文件已进覆盖账本）。

## 边界

- 删除不可恢复；只删磁盘上的会话目录，不碰工作区本身。
- 归档/置顶集合的清理是 best-effort：失败只记日志，不阻断删除。
- 页面在删除后整页重载一次（列表/索引/搜索都会重读）。
