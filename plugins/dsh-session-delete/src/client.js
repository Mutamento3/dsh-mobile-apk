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

        /**
         * Hide rows whose session was deleted on this device.
         * @returns {Function} disposer removing the injected style.
         */
        function installHiddenStyles() {
          var ids = readHiddenIds()
          if (ids.length === 0) return function () {}
          var style = document.createElement('style')
          style.dataset.plugin = 'dsh-session-delete'
          style.textContent = ids.map(function (id) {
            return '[data-row-key="session:' + id + '"]{display:none !important}'
          }).join('\n')
          document.head.appendChild(style)
          return function () { style.remove() }
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

          function confirmDelete() {
            trace('info', 'confirm accepted, sending request', { sessionId: target.sessionId })
            setBusy(true)
            setError(null)
            fetch('/api/session-delete', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ sessionId: target.sessionId }),
            })
              .then(function (res) {
                return res.json().catch(function () { return {} }).then(function (data) {
                  if (!res.ok || data.ok !== true) {
                    // 404 = the session is already gone (deleted earlier, or the engine
                    // restarted): treat it as success so a retry is idempotent.
                    if (res.status === 404) {
                      trace('warn', 'session already gone; treating as deleted', { sessionId: target.sessionId })
                      return { ok: true, sessionId: target.sessionId, alreadyGone: true }
                    }
                    throw new Error(data.message || data.error || ('HTTP ' + res.status))
                  }
                  return data
                })
              })
              .then(function (data) {
                rememberHiddenId(target.sessionId)
                trace('info', 'delete succeeded, reloading', { sessionId: target.sessionId, dir: data.dir, alreadyGone: data.alreadyGone === true })
                window.location.reload()
              })
              .catch(function (reason) {
                var message = String(reason && reason.message ? reason.message : reason)
                trace('error', 'delete failed', { sessionId: target.sessionId, message: message })
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
          ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }) }, 'session-delete: dictionaries')
          ctx.effect(installHiddenStyles, 'session-delete: hide deleted rows')
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
