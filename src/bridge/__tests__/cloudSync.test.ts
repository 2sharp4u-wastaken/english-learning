import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getPlayerLinks,
  linkPlayer,
  unlinkPlayer,
  getLinkedPlayerId,
  isPlayerLinked,
  pushBackup,
  pullBackup,
  linkAndBackup,
} from '../cloudSync'

/**
 * Cloud Phase B sync bridge — mocks fetch. Pins the link map, the push (reads the
 * raw per-user blobs + sends the Bearer + PUTs), the pull (writes blobs back),
 * link-and-backup (creates a cloud player then pushes), and the not-linked guard.
 */

function jsonRes(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

/** vi.fn() for fetch — `any` so `.mock.calls[i]` indexing isn't tuple-narrowed. */
function fetchFn(impl?: (...a: any[]) => any) {
  return vi.fn(impl) as any
}

const PROGRESS = 'v2_userProgress_kid1'
const PREFS = 'v2_playerPrefs_kid1'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('cloudToken', 'jwt-abc')
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('link map', () => {
  it('links, reads, and unlinks a local↔cloud pair', () => {
    expect(getPlayerLinks()).toEqual({})
    expect(isPlayerLinked('kid1')).toBe(false)
    linkPlayer('kid1', 'cloud-9')
    expect(getLinkedPlayerId('kid1')).toBe('cloud-9')
    expect(isPlayerLinked('kid1')).toBe(true)
    unlinkPlayer('kid1')
    expect(getLinkedPlayerId('kid1')).toBeNull()
  })
})

describe('pushBackup', () => {
  it('refuses an unlinked profile without calling the network', async () => {
    const fetchMock = fetchFn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const r = await pushBackup('kid1')
    expect(r.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('PUTs progress + prefs blobs with the Bearer token', async () => {
    linkPlayer('kid1', 'cloud-9')
    localStorage.setItem(PROGRESS, '{"coins":5}')
    localStorage.setItem(PREFS, '{"theme":"ocean"}')
    const fetchMock = fetchFn(async () => jsonRes(200, { ok: true, updated: 'now' }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const r = await pushBackup('kid1')
    expect(r.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [progUrl, progInit] = fetchMock.mock.calls[0]
    expect(progUrl).toBe('/api/progress/cloud-9')
    expect((progInit as RequestInit).method).toBe('PUT')
    expect((progInit as any).headers.authorization).toBe('Bearer jwt-abc')
    expect(JSON.parse((progInit as any).body).blob).toBe('{"coins":5}')
    expect(fetchMock.mock.calls[1][0]).toBe('/api/prefs/cloud-9')
  })

  it('only pushes the blobs that exist locally', async () => {
    linkPlayer('kid1', 'cloud-9')
    localStorage.setItem(PROGRESS, '{"coins":5}') // no prefs blob
    const fetchMock = fetchFn(async () => jsonRes(200, { ok: true }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    await pushBackup('kid1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/progress/cloud-9')
  })
})

describe('pullBackup', () => {
  it('writes cloud blobs into localStorage and reports restored', async () => {
    linkPlayer('kid1', 'cloud-9')
    const fetchMock = fetchFn()
      .mockResolvedValueOnce(jsonRes(200, { blob: '{"coins":42}', updated: 't1' }))
      .mockResolvedValueOnce(jsonRes(200, { blob: '{"theme":"sunset"}', updated: 't2' }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const r = await pullBackup('kid1')
    expect(r.ok).toBe(true)
    expect(r.data?.restored).toBe(true)
    expect(localStorage.getItem(PROGRESS)).toBe('{"coins":42}')
    expect(localStorage.getItem(PREFS)).toBe('{"theme":"sunset"}')
  })

  it('reports restored=false and touches nothing when the cloud is empty', async () => {
    linkPlayer('kid1', 'cloud-9')
    const fetchMock = fetchFn(async () => jsonRes(200, { blob: null, updated: null }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const r = await pullBackup('kid1')
    expect(r.ok).toBe(true)
    expect(r.data?.restored).toBe(false)
    expect(localStorage.getItem(PROGRESS)).toBeNull()
  })
})

describe('linkAndBackup', () => {
  it('creates a cloud player, records the link, then pushes', async () => {
    localStorage.setItem(PROGRESS, '{"coins":1}')
    const fetchMock = fetchFn()
      .mockResolvedValueOnce(jsonRes(200, { player: { id: 'cloud-new', name: 'Dana' } })) // create
      .mockResolvedValueOnce(jsonRes(200, { ok: true })) // push progress
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const r = await linkAndBackup('kid1', 'Dana', 'D')
    expect(r.ok).toBe(true)
    expect(getLinkedPlayerId('kid1')).toBe('cloud-new')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/players')
    expect(fetchMock.mock.calls[1][0]).toBe('/api/progress/cloud-new')
  })
})
