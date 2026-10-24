import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  SessionDeleteError,
  assertSessionId,
  deleteStoredSession,
  findSessionDir,
  sessionsRoot,
} from '../src/session-delete.js'

const ID = 'session-12345678-1234-4abc-8def-1234567890ab'

async function homeWith(ids, key = '--workspace--') {
  const home = await mkdtemp(join(tmpdir(), 'dsh-session-delete-'))
  for (const id of ids) {
    const dir = join(sessionsRoot(home), key, id)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'session.lock'), '')
    await writeFile(join(dir, 'session.v4.jsonl.zstd'), 'x')
  }
  return home
}

test('rejects ids that are not session-<uuid>', async () => {
  for (const bad of ['', 'session-1', '../etc/passwd', 'session-12345678-1234-4abc-8def-1234567890ab/../x']) {
    assert.throws(() => assertSessionId(bad), (error) => error instanceof SessionDeleteError && error.code === 'invalid-id')
  }
})

test('reports a missing session without touching the tree', async () => {
  const home = await homeWith([])
  await assert.rejects(
    deleteStoredSession({ home, sessionId: ID }),
    (error) => error instanceof SessionDeleteError && error.code === 'not-found',
  )
})

test('refuses to delete a session that is still running', async () => {
  const home = await homeWith([ID])
  await assert.rejects(
    deleteStoredSession({ home, sessionId: ID, isActive: true }),
    (error) => error instanceof SessionDeleteError && error.code === 'session-active',
  )
  const dir = join(sessionsRoot(home), '--workspace--', ID)
  assert.equal((await stat(dir)).isDirectory(), true)
})

test('deletes the stored directory and runs bookkeeping first', async () => {
  const home = await homeWith([ID])
  const seen = []
  const result = await deleteStoredSession({
    home,
    sessionId: ID,
    isActive: false,
    beforeRemove: async (info) => { seen.push(info.sessionId) },
  })
  assert.equal(result.ok, true)
  assert.deepEqual(seen, [ID])
  const groups = await readdir(sessionsRoot(home))
  assert.equal(groups.length, 1)
  assert.deepEqual(await readdir(join(sessionsRoot(home), '--workspace--')), [])
})

test('refuses an ambiguous id that exists in two workspace directories', async () => {
  const home = await homeWith([ID], '--a--')
  await homeWith([]) // keep mkdtemp shape stable; create the second copy explicitly below
  const second = join(sessionsRoot(home), '--b--', ID)
  await mkdir(second, { recursive: true })
  await assert.rejects(
    deleteStoredSession({ home, sessionId: ID }),
    (error) => error instanceof SessionDeleteError && error.code === 'ambiguous',
  )
  assert.equal((await stat(join(sessionsRoot(home), '--a--', ID))).isDirectory(), true)
  assert.equal((await stat(second)).isDirectory(), true)
})

test('findSessionDir resolves the single matching directory', async () => {
  const home = await homeWith([ID])
  assert.equal(await findSessionDir(sessionsRoot(home), ID), join(sessionsRoot(home), '--workspace--', ID))
})

// ── host 侧编排：removeSession 用注入的 ctx 读活会话/工作区登记，再走同一个核心 ──
import { removeSession } from '../src/index.js'

function fakeCtx({ live = false, activity = [], registry = {} } = {}) {
  return {
    get(name) {
      if (name === 'sessions') return { get: (id) => (live ? { header: { id } } : undefined) }
      if (name === 'workspaceRegistry') return registry
      return undefined
    },
    waterfall: async () => activity,
  }
}

test('removeSession refuses a running session before touching the disk', async () => {
  const home = await homeWith([ID])
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = home
  try {
    await assert.rejects(
      removeSession(fakeCtx({ live: true, activity: [{ kind: 'agent' }] }), ID),
      (error) => error instanceof SessionDeleteError && error.code === 'session-active',
    )
    assert.equal((await stat(join(sessionsRoot(home), '--workspace--', ID))).isDirectory(), true)
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  }
})

test('removeSession deletes a loaded but idle session (live != running)', async () => {
  const home = await homeWith([ID])
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = home
  try {
    const result = await removeSession(fakeCtx({ live: true, activity: [] }), ID)
    assert.equal(result.ok, true)
    assert.deepEqual(await readdir(join(sessionsRoot(home), '--workspace--')), [])
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  }
})

test('removeSession drops archive/pin membership then deletes the directory', async () => {
  const home = await homeWith([ID])
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = home
  const calls = []
  try {
    const result = await removeSession(fakeCtx({
      registry: {
        unarchiveSession: async (id) => { calls.push('unarchive:' + id) },
        unpinSession: async (id) => { calls.push('unpin:' + id) },
      },
    }), ID)
    assert.equal(result.ok, true)
    assert.deepEqual(calls, ['unarchive:' + ID, 'unpin:' + ID])
    assert.deepEqual(await readdir(join(sessionsRoot(home), '--workspace--')), [])
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  }
})

test('logs every deletion step through the injected logger', async () => {
  const home = await homeWith([ID])
  const lines = []
  await deleteStoredSession({
    home,
    sessionId: ID,
    logger: (level, message) => lines.push(level + ':' + message),
  })
  assert.deepEqual(lines, [
    'info:delete requested',
    'info:resolved session directory',
    'info:moving session directory out of the scan path',
    'info:removing session directory',
    'info:session deleted',
  ])
})
