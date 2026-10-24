/**
 * Host half: `POST /api/session-delete` removes one stored conversation.
 *
 * The engine ships no session-delete RPC (issue #493), so the plugin owns the
 * on-disk half. It is deliberately narrow:
 * - same-origin authenticated route (client-connection rejection is honoured);
 * - `session-<uuid>` ids only;
 * - a session with running work is refused (409), and an unverifiable activity probe
 *   refuses too — "unknown" is never treated as "idle";
 * - a loaded-but-idle session is unloaded (detach + flush) after the directory leaves
 *   the scan path, so it stops appearing in search;
 * - archive/pin membership is dropped best-effort before the directory goes away.
 *
 * The client half (session row menu) is the only caller; the route is not a
 * general file-deletion primitive.
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SessionDeleteError, deleteStoredSession } from './session-delete.js'

/** Log tag shared with the client half so device logs can be grepped by one string. */
const TAG = '[dsh-session-delete]'

/**
 * Log through the engine logger when present, with a console fallback.
 * @param {object} ctx - cordis context.
 * @param {'info'|'warn'|'error'} level - severity.
 * @param {string} message - short step description.
 * @param {object} [extra] - structured fields.
 */
function log(ctx, level, message, extra) {
  const line = TAG + ' ' + message
  // stdout is the only sink the Android shell keeps (engine.log): `ctx.logger.info`
  // is filtered out of it, so the trace goes to console unconditionally. The engine
  // logger still gets warnings/errors for anything that should surface at that level.
  const write = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  write(line, extra === undefined ? '' : extra)
  if (level !== 'info') {
    try {
      const logger = ctx?.logger
      const surface = logger?.[level]
      if (typeof surface === 'function') surface.call(logger, line, extra === undefined ? '' : JSON.stringify(extra))
    } catch {
      /* logging must never break the request */
    }
  }
}

/** Exact route; the auth gate requires this registration to authenticate itself. */
export const ROUTE = '/api/session-delete'
/** Request bodies are a single id; anything larger is refused before parsing. */
const MAX_BODY_BYTES = 4096

const HERE = dirname(fileURLToPath(import.meta.url))

/**
 * Build stamp baked by build.mjs; the client compares it with its own constant
 * and reloads once when they differ (a page can outlive an engine restart).
 * @returns {string} stamp or `unknown`.
 */
function buildStamp() {
  try {
    return JSON.parse(readFileSync(join(HERE, 'build.json'), 'utf8')).stamp ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

export const name = 'dsh-session-delete'
export const inject = ['webServer']

/**
 * Write one JSON response.
 * @param {import('node:http').ServerResponse} res - response.
 * @param {number} status - HTTP status.
 * @param {object} payload - JSON body.
 */
function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(payload))
}

/**
 * Honour the engine's browser-auth rejection for this request.
 * @param {import('node:http').IncomingMessage} req - request.
 * @param {import('node:http').ServerResponse} res - response.
 * @param {object} ctx - cordis context.
 * @returns {boolean} true when the request may proceed.
 */
function authorize(req, res, ctx) {
  let rejection = 401
  try {
    const connection = ctx.get('connection')
    if (typeof connection?.requestRejection === 'function') rejection = connection.requestRejection(req)
  } catch {
    /* treat an unreadable connection as unauthenticated */
  }
  if (rejection === undefined) return true
  if (rejection === 403) {
    res.writeHead(403, { 'cache-control': 'no-store' })
    res.end()
  } else {
    res.writeHead(401, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end('{"ok":false,"error":"unauthorized"}')
  }
  return false
}

/**
 * Read a bounded JSON body.
 * @param {import('node:http').IncomingMessage} req - request.
 * @returns {Promise<any>} parsed body.
 * @throws {SessionDeleteError} `invalid-body` when oversized or not JSON.
 */
async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new SessionDeleteError('invalid-body', 'request body is too large')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new SessionDeleteError('invalid-body', 'request body must be JSON')
  }
}

/**
 * Ask every provider whether the session has running work.
 * @param {object} ctx - cordis context.
 * @param {string} sessionId - session to inspect.
 * @returns {Promise<Array<{ kind?: string }>>} reported activity (empty when idle).
 */
async function sessionActivity(ctx, sessionId) {
  // 老引擎没有 waterfall：返回 null（未知），调用方按「加载过就算忙」保守处理，
  // 绝不能在无法判断时把可能正在运行的会话删掉。
  if (typeof ctx.waterfall !== 'function') return null
  try {
    const reported = await ctx.waterfall('workspace/session-activity', { sessionId }, () => Promise.resolve([]))
    if (!Array.isArray(reported)) {
      log(ctx, 'warn', 'activity probe returned a non-array; refusing to guess', { sessionId, type: typeof reported })
      return null
    }
    return reported
  } catch (error) {
    // 探测失败 ≠ 空闲：宁可拒绝，也不能把可能正在运行的会话删掉。
    log(ctx, 'warn', 'activity probe failed; refusing to delete', { sessionId, error: String(error?.message ?? error) })
    return null
  }
}

/**
 * Delete one stored session through the engine's own registries.
 * @param {object} ctx - cordis context.
 * @param {string} sessionId - validated id.
 * @returns {Promise<{ ok: true, sessionId: string, dir: string }>} outcome.
 */
export async function removeSession(ctx, sessionId) {
  const sessions = ctx.get('sessions')
  // 引擎把「打开过」的会话都留在内存里（sessions.list），所以「live」不等于「正在跑」。
  // 只拦真正有活动（运行中的回合、终端等）的会话：workspace/session-activity 是上游
  // 归档路径用的同一判据，这里复用，避免把「看过的对话」也判成不可删。
  const live = sessions?.get?.(sessionId) !== undefined
  const activity = await sessionActivity(ctx, sessionId)
  if (activity === null) {
    throw new SessionDeleteError('activity-unknown', 'cannot verify whether the conversation is idle; refusing to delete', { sessionId })
  }
  const active = activity.length > 0
  const registry = ctx.get('workspaceRegistry')
  log(ctx, 'info', 'host delete start', {
    sessionId,
    live,
    activity: activity.map((entry) => entry?.kind ?? 'unknown'),
    home: process.env.DSH_HOME ?? join(homedir(), '.dsh'),
    hasRegistry: registry !== undefined,
  })
  return deleteStoredSession({
    home: process.env.DSH_HOME ?? join(homedir(), '.dsh'),
    sessionId,
    isActive: active,
    logger: (level, message, extra) => log(ctx, level, message, extra),
    // 只删磁盘会让会话继续留在 sessions.list() 里参与搜索；但卸载必须发生在
    // 「目录已改名」之后，否则删除失败时用户白丢正在看的会话。
    afterRename: async () => {
      if (!live) return
      try {
        const session = sessions?.get?.(sessionId)
        const entry = session === undefined ? undefined : sessions?.liveEntryFor?.(session)
        if (entry !== undefined && typeof entry.detach === 'function') {
          entry.detach()
          log(ctx, 'info', 'detached the live session', { sessionId })
        } else {
          log(ctx, 'warn', 'live session has no detach capability; it may stay in the live list', { sessionId })
        }
      } catch (error) {
        log(ctx, 'warn', 'session detach failed', { sessionId, error: String(error?.message ?? error) })
      }
      try {
        await sessions?.flush?.()
        log(ctx, 'info', 'flushed session persistence after detach', { sessionId })
      } catch (error) {
        log(ctx, 'warn', 'flush after detach failed', { sessionId, error: String(error?.message ?? error) })
      }
    },
    beforeRemove: async () => {
      try {
        await registry?.unarchiveSession?.(sessionId)
        log(ctx, 'info', 'unarchived session', { sessionId })
      } catch (error) {
        log(ctx, 'warn', 'unarchive failed (ignored)', { sessionId, error: String(error?.message ?? error) })
      }
      try {
        await registry?.unpinSession?.(sessionId)
        log(ctx, 'info', 'unpinned session', { sessionId })
      } catch (error) {
        log(ctx, 'warn', 'unpin failed (ignored)', { sessionId, error: String(error?.message ?? error) })
      }
    },
  })
}

/**
 * Map a failure onto an HTTP status.
 * @param {unknown} error - thrown value.
 * @returns {{ status: number, code: string, message: string }}
 */
function failureOf(error) {
  const code = error instanceof SessionDeleteError ? error.code : 'delete-failed'
  const status = code === 'invalid-id' || code === 'invalid-body'
    ? 400
    : code === 'not-found' ? 404
      : code === 'session-active' || code === 'activity-unknown' || code === 'ambiguous' ? 409
        : 500
  return { status, code, message: String(error?.message ?? error) }
}

/**
 * Register the route.
 * @param {object} ctx - cordis context.
 */
export function apply(ctx) {
  log(ctx, 'info', 'registering route', { path: ROUTE })
  // 客户端决策回传：删除后界面为什么没切换，只有浏览器侧知道；把它的选择写进
  // engine.log（[dsh-session-delete] client trace …），现场问题不必再靠猜。
  ctx.webServer.register({
    kind: 'exact',
    path: '/api/session-delete-version',
    handler: async (req, res) => {
      if (!authorize(req, res, ctx)) return
      sendJson(res, 200, { ok: true, stamp: buildStamp() })
    },
  })
  ctx.webServer.register({
    kind: 'exact',
    path: '/api/session-delete-trace',
    handler: async (req, res) => {
      if (!authorize(req, res, ctx)) return
      if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
        return
      }
      try {
        const body = await readJsonBody(req)
        log(ctx, 'info', 'client trace', body)
      } catch (error) {
        log(ctx, 'warn', 'client trace unreadable', { error: String(error?.message ?? error) })
      }
      sendJson(res, 200, { ok: true })
    },
  })
  ctx.webServer.register({
    kind: 'exact',
    path: '/api/session-delete',
    handler: async (req, res) => {
      const startedAt = Date.now()
      log(ctx, 'info', 'route hit', { method: req.method, url: req.url })
      if (!authorize(req, res, ctx)) {
        log(ctx, 'warn', 'request rejected by connection auth', { method: req.method })
        return
      }
      if (req.method !== 'POST') {
        log(ctx, 'warn', 'method not allowed', { method: req.method })
        sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
        return
      }
      try {
        const body = await readJsonBody(req)
        log(ctx, 'info', 'request parsed', { sessionId: body?.sessionId })
        const result = await removeSession(ctx, body?.sessionId)
        log(ctx, 'info', 'route completed', { sessionId: result.sessionId, ms: Date.now() - startedAt })
        sendJson(res, 200, result)
      } catch (error) {
        const failure = failureOf(error)
        log(ctx, 'error', 'route failed', {
          status: failure.status,
          code: failure.code,
          message: failure.message,
          ms: Date.now() - startedAt,
        })
        sendJson(res, failure.status, { ok: false, error: failure.code, message: failure.message })
      }
    },
  })
}
