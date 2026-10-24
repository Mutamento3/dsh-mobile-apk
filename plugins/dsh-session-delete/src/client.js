/**
 * Client half: a "Delete conversation" item in the session row menu.
 *
 * The engine has no delete action (issue #493), so the item asks the host route
 * (`POST /api/session-delete`) to remove the stored session, then reloads the
 * page so every list/index reads the new state. Deletion is irreversible and
 * therefore always confirmed in a modal — never `window.confirm`, which the
 * Android shell auto-approves.
 */
;(function () {
  try {
    window.__ModuleLoader__.load({
      id: '@dsh-android/dsh-session-delete',
      factory: function (require) {
        var module = { exports: {} }
        var exports = module.exports
        Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

        var react = require('react')
        var primitives = require('@deepseek-ai/dsh-client-ui-primitives')
        var h = react.createElement

        var NS = 'session-delete'
        /**
         * Session ids this device already deleted. The engine keeps loaded
         * sessions in memory until the next start, so the row would otherwise
         * stay visible (and a second click would 404). Hidden ids are applied
         * as a stylesheet rule on the next load; capped to keep the entry small.
         */
        var HIDDEN_KEY = 'dsh.session-delete.hidden'
        var HIDDEN_LIMIT = 200
        /** Same tag as the host half so device logs can be grepped by one string. */
        var TAG = '[dsh-session-delete]'

        /**
         * Read the locally deleted session ids.
         * @returns {string[]} ids, oldest first.
         */
        function readHiddenIds() {
          try {
            var raw = window.localStorage.getItem(HIDDEN_KEY)
            var parsed = raw === null ? [] : JSON.parse(raw)
            return Array.isArray(parsed) ? parsed.filter(function (id) { return typeof id === 'string' }) : []
          } catch (_) {
            return []
          }
        }

        /**
         * Remember one deleted session id for the local hide list.
         * @param {string} sessionId - deleted session.
         */
        function rememberHiddenId(sessionId) {
          try {
            var ids = readHiddenIds().filter(function (id) { return id !== sessionId })
            ids.push(sessionId)
            window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids.slice(-HIDDEN_LIMIT)))
          } catch (_) {
            /* storage unavailable: the row simply stays visible until restart */
          }
        }

        /** Style tag id carrying the local hide rules. */
        var STYLE_ID = 'dsh-session-delete-hidden'

        /**
         * Rewrite the local hide rules from the stored ids.
         *
         * Runs on load and again right after a delete, so the row disappears
         * without waiting for a reload (the open-conversation path never reloads).
         */
        function refreshHiddenStyles() {
          var ids = readHiddenIds()
          var style = document.getElementById(STYLE_ID)
          if (ids.length === 0) {
            if (style !== null) style.remove()
            return
          }
          if (style === null) {
            style = document.createElement('style')
            style.id = STYLE_ID
            style.dataset.plugin = 'dsh-session-delete'
            document.head.appendChild(style)
          }
          style.textContent = ids.map(function (id) {
            return '[data-row-key="session:' + id + '"]{display:none !important}'
          }).join('\n')
        }

        /**
         * Open a fresh conversation through the app's own control.
         *
         * Deleting the mounted session cannot just reload: the engine keeps the
         * session in its live list, so the reload restores the deleted page.
         * The sidebar's new-session button creates and selects a new session.
         * @returns {boolean} true when a control was found and clicked.
         */
        /**
         * Session currently rendered on screen.
         *
         * `[data-conversation-session]` is the conversation body's own id and is
         * present for every rendered conversation (main view or panel). The
         * `<html data-dsh-session-id>` marker is the shell's shell-wide hint and
         * is absent on some layouts (measured: null while a conversation was
         * open), so it is only the fallback.
         * @returns {string|null} mounted session id.
         */
        function mountedSessionId() {
          var body = document.querySelector('[data-conversation-session]')
          if (body !== null) {
            var fromBody = body.getAttribute('data-conversation-session')
            if (fromBody !== null && fromBody !== '') return fromBody
          }
          return document.documentElement.getAttribute('data-dsh-session-id')
        }

        /**
         * Per-attempt timeout. A local delete answers in ~20ms; anything slower than
         * this is a dead keep-alive socket left over from an engine restart, and
         * aborting it makes the browser drop that socket. 2s keeps the dialog honest
         * without making the user wait for the OS TCP timeout.
         */
        var REQUEST_TIMEOUT_MS = 2000
        /** Attempts per click: first try plus two fresh-connection retries. */
        var MAX_ATTEMPTS = 3

        /**
         * POST the delete request with a hard timeout.
         *
         * The WebView can hold a keep-alive connection to an engine process that
         * just restarted; the request then never reaches the new process and the
         * dialog would sit on「正在删除…」forever (measured: zero route hits in
         * engine.log while curl answered in 13 ms).
         * @param {string} sessionId - session to delete.
         * @returns {Promise<Response>} the fetch response.
         */
        function postDelete(sessionId) {
          var init = {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessionId: sessionId }),
          }
          if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
            init.signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
          }
          return fetch('/api/session-delete', init)
        }

        /**
         * Report the post-delete navigation decision to the host log.
         * @param {object} payload - decision details.
         */
        function reportTrace(payload) {
          try {
            var init = {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(payload),
            }
            // 诊断请求也带超时：一条挂死的 trace 会占住浏览器连接池的槽位，
            // 反而拖慢真正的删除请求。
            if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
              init.signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
            }
            fetch('/api/session-delete-trace', init).catch(function () {})
          } catch (_) {
            /* diagnostics only */
          }
        }

        /**
         * Leave the deleted conversation through the upstream workspace store.
         *
         * Upstream's own archive path does exactly this when the archived session is
         * the main view: `if (this.mainReference?.sessionId === sessionId) this.clearMain()`.
         * Reusing the service beats guessing at DOM buttons.
         * @returns {boolean} true when the store cleared the main view.
         */
        function clearMainView() {
          try {
            var workspace = pluginCtx === null || typeof pluginCtx.get !== 'function'
              ? undefined
              : pluginCtx.get('uiWorkspace')
            if (workspace !== undefined && workspace !== null && typeof workspace.clearMain === 'function') {
              workspace.clearMain()
              trace('info', 'cleared the main view via uiWorkspace.clearMain()')
              return true
            }
            trace('warn', 'uiWorkspace.clearMain is not available; falling back to DOM controls')
          } catch (error) {
            trace('warn', 'uiWorkspace.clearMain threw', { message: String(error && error.message ? error.message : error) })
          }
          return false
        }

        function goToNewSession() {
          var buttons = Array.prototype.slice.call(document.querySelectorAll('button'))
          var match = buttons.find(function (button) {
            // Upstream marks the control with css.newSession (CSS Modules keep the
            // name). The visible label is「在“X”中新建会话」/“New session in X”, which
            // does NOT contain the substring「新会话」— matching text alone missed it
            // and fell back to a reload that restored the deleted page.
            var className = button.className
            if (typeof className === 'string' && className.indexOf('newSession') !== -1) return true
            var label = (button.getAttribute('aria-label') || '') + ' ' + (button.textContent || '')
            return /新会话|新建会话|New session/i.test(label)
          })
          if (match === undefined) return false
          trace('info', 'clicking the new-session control', {
            className: String(match.className || ''),
            label: match.getAttribute('aria-label') || '',
          })
          match.click()
          return true
        }

        /**
         * Client-side trace (browser console; visible over CDP).
         * @param {'info'|'warn'|'error'} level - severity.
         * @param {string} message - step description.
         * @param {object} [extra] - structured fields.
         */
        function trace(level, message, extra) {
          var line = TAG + ' ' + message
          if (level === 'error') console.error(line, extra === undefined ? '' : extra)
          else if (level === 'warn') console.warn(line, extra === undefined ? '' : extra)
          else console.info(line, extra === undefined ? '' : extra)
        }
        var zh = {
          'menu.delete': '删除对话',
          'confirm.title': '删除对话',
          'confirm.desc': '「{title}」将从磁盘永久删除，无法恢复。',
          'cancel': '取消',
          'delete': '删除',
          'deleting': '正在删除…',
          'error': '删除失败：{message}',
          'close': '关闭',
        }
        var en = {
          'menu.delete': 'Delete conversation',
          'confirm.title': 'Delete conversation',
          'confirm.desc': '"{title}" will be permanently deleted from disk. This cannot be undone.',
          'cancel': 'Cancel',
          'delete': 'Delete',
          'deleting': 'Deleting…',
          'error': 'Delete failed: {message}',
          'close': 'Close',
        }

        var cancelStyle = {
          minHeight: '34px',
          padding: '0 14px',
          borderRadius: 'var(--dsw-radius-md)',
          border: '1px solid var(--dsw-alias-border-l3)',
          background: 'transparent',
          color: 'var(--dsw-alias-label-primary)',
          font: 'inherit',
          fontSize: '13px',
          cursor: 'pointer',
        }
        var deleteStyle = {
          minHeight: '34px',
          padding: '0 14px',
          borderRadius: 'var(--dsw-radius-md)',
          border: '1px solid transparent',
          background: 'var(--dsw-alias-state-error-primary)',
          color: 'var(--dsw-alias-label-primary-foreground)',
          font: 'inherit',
          fontSize: '13px',
          cursor: 'pointer',
        }

        /**
         * Pending deletion shared by the menu item and the overlay dialog.
         *
         * The menu item cannot own the dialog: selecting an item closes the menu,
         * which unmounts the item — a dialog rendered there would never appear.
         * The item only records the target; `shell.overlay` renders the confirm.
         */
        /** Client context, captured in apply so the overlay can reach upstream services. */
        var pluginCtx = null
        var pending = null
        var listeners = new Set()
        function setPending(next) {
          pending = next
          listeners.forEach(function (listener) { listener() })
        }
        function subscribe(listener) {
          listeners.add(listener)
          return function () { listeners.delete(listener) }
        }
        function usePending() {
          return react.useSyncExternalStore(subscribe, function () { return pending })
        }

        /**
         * Menu item: opens the confirmation for this session.
         * @param {object} props - slot props (`sessionId`, `displayTitle`, `useMenuOpenState`, `t`).
         * @returns {object} React element.
         */
        function DeleteSessionMenuItem(props) {
          var setMenuOpen = props.useMenuOpenState()[1]
          var t = props.t
          return h(primitives.MenuItemButton, {
            danger: true,
            icon: h(primitives.IconTrashOutlineRegular, { size: 14 }),
            onSelect: function () {
              trace('info', 'menu item selected', { sessionId: props.sessionId })
              setMenuOpen(false)
              setPending({ sessionId: props.sessionId, title: props.displayTitle || props.sessionId })
            },
          }, t('menu.delete'))
        }

        /**
         * Overlay dialog: confirms and performs the deletion.
         * @param {object} props - slot props (`t`).
         * @returns {object|null} React element or null while idle.
         */
        function DeleteConfirmDialog(props) {
          var t = props.t
          var target = usePending()
          var busyPair = react.useState(false)
          var busy = busyPair[0]
          var setBusy = busyPair[1]
          var errorPair = react.useState(null)
          var error = errorPair[0]
          var setError = errorPair[1]

          if (target === null) return null

          function close() {
            if (busy) return
            setError(null)
            setPending(null)
          }

          /**
           * One delete attempt; retries on a timeout with a fresh connection.
           * @param {number} n - zero-based attempt index.
           * @returns {Promise<object>} server payload.
           */
          function attemptDelete(n) {
            return postDelete(target.sessionId)
              .then(function (res) {
                return res.json().catch(function () { return {} }).then(function (data) {
                  if (!res.ok || data.ok !== true) {
                    // 404 = already gone (deleted earlier, or the engine restarted).
                    if (res.status === 404) {
                      trace('warn', 'session already gone; treating as deleted', { sessionId: target.sessionId })
                      return { ok: true, sessionId: target.sessionId, alreadyGone: true }
                    }
                    throw new Error(data.message || data.error || ('HTTP ' + res.status))
                  }
                  return data
                })
              })
              .catch(function (reason) {
                var retryable = reason && (reason.name === 'TimeoutError' || reason.name === 'AbortError')
                if (retryable && n + 1 < MAX_ATTEMPTS) {
                  trace('warn', 'delete attempt timed out; retrying on a fresh connection', {
                    sessionId: target.sessionId,
                    attempt: n + 1,
                  })
                  reportTrace({ event: 'delete-retry', sessionId: target.sessionId, attempt: n + 1 })
                  return attemptDelete(n + 1)
                }
                throw reason
              })
          }

          /**
           * Post-delete bookkeeping: hide the row, then leave the deleted conversation.
           * @param {object} data - server payload.
           */
          function afterDeleted(data) {
            rememberHiddenId(target.sessionId)
            refreshHiddenStyles()
            var mounted = mountedSessionId()
            var report = { sessionId: target.sessionId, mountedBefore: mounted, url: window.location.href }
            if (mounted !== target.sessionId) {
              report.decision = 'reload-not-mounted'
              reportTrace(report)
              window.location.reload()
              return
            }
            report.clearedMain = clearMainView()
            setTimeout(function () {
              var afterClear = mountedSessionId()
              report.mountedAfterClearMain = afterClear
              if (afterClear !== target.sessionId) {
                report.decision = 'cleared-main'
                reportTrace(report)
                return
              }
              report.newSessionControl = goToNewSession()
              setTimeout(function () {
                var afterNew = mountedSessionId()
                report.mountedAfterNewSession = afterNew
                if (afterNew !== target.sessionId) {
                  report.decision = 'switched-to-new-session'
                  reportTrace(report)
                  return
                }
                // 最后兜底：点侧栏里另一条会话，把主视图从已删会话上移开。
                var row = document.querySelector('[data-row-key^="session:"]')
                report.fallbackRow = row === null ? null : row.getAttribute('data-row-key')
                if (row !== null) row.click()
                setTimeout(function () {
                  report.mountedAfterRowClick = mountedSessionId()
                  report.decision = report.mountedAfterRowClick === target.sessionId ? 'still-mounted-reloading' : 'switched-by-row'
                  reportTrace(report)
                  if (report.mountedAfterRowClick === target.sessionId) window.location.reload()
                }, 600)
              }, 600)
            }, 300)
          }

          function confirmDelete() {
            trace('info', 'confirm accepted, sending request', { sessionId: target.sessionId })
            setBusy(true)
            setError(null)
            attemptDelete(0)
              .then(afterDeleted)
              .catch(function (reason) {
                var message = String(reason && reason.message ? reason.message : reason)
                trace('error', 'delete failed', { sessionId: target.sessionId, message: message })
                reportTrace({ event: 'delete-failed', sessionId: target.sessionId, message: message })
                setError(message)
                setBusy(false)
              })
          }

          return h(primitives.Modal, {
            open: true,
            onClose: close,
            title: t('confirm.title'),
            closeLabel: t('close'),
            description: t('confirm.desc', { title: target.title }),
            footer: h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
              h('button', { type: 'button', style: cancelStyle, disabled: busy, onClick: close }, t('cancel')),
              h('button', { type: 'button', style: deleteStyle, disabled: busy, onClick: confirmDelete },
                busy ? t('deleting') : t('delete'))),
          }, error === null ? null : h('p', {
            role: 'alert',
            style: { margin: '8px 0 0', color: 'var(--dsw-alias-state-error-primary)', fontSize: '12px', lineHeight: '18px' },
          }, t('error', { message: error })))
        }

        /** @param {object} ctx - cordis client context. */
        function apply(ctx) {
          pluginCtx = ctx
          // 自证：页面里的这份代码能否连通 host。engine.log 里看到这条，说明
          // 浏览器→引擎这条路是通的；看不到就说明页面还是旧连接/旧 bundle。
          setTimeout(function () {
            reportTrace({ event: 'plugin-loaded', url: window.location.href, hasAbort: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' })
          }, 1200)
          ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }) }, 'session-delete: dictionaries')
          ctx.effect(function () {
            refreshHiddenStyles()
            return function () {
              var style = document.getElementById(STYLE_ID)
              if (style !== null) style.remove()
            }
          }, 'session-delete: hide deleted rows')
          ctx.slots.inject('sidebar.workspaces.session.menu.item', function () {
            return ctx.slots.register({
              name: 'sidebar.workspaces.session.menu.item',
              id: 'delete',
              order: 500,
              locale: NS,
            }, DeleteSessionMenuItem)
          })
          ctx.slots.inject('shell.overlay', function () {
            return ctx.slots.register({
              name: 'shell.overlay',
              id: 'session-delete-confirm',
              locale: NS,
            }, DeleteConfirmDialog)
          })
        }

        exports.name = 'dsh-session-delete'
        exports.inject = ['slots', 'locale']
        exports.apply = apply
        return module.exports
      },
    })
  } catch (err) {
    console.warn('[dsh-session-delete] client runtime error:', err)
  }
})()
