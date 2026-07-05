import { describe, it, expect } from 'vitest'
import { buildBackupJson, restoreBackup } from '../backup'

describe('local backup (bridge/backup)', () => {
  it('round-trips all keys except BACKUP_EXCLUDE secrets', () => {
    localStorage.setItem('users', '{"omer":{}}')
    localStorage.setItem('v2_userProgress_omer', '{"totalGamesPlayed":7}')
    localStorage.setItem('cloudToken', 'jwt-secret') // must NOT be exported

    const json = buildBackupJson()
    const parsed = JSON.parse(json)
    expect(parsed.format).toBe('english-learning-backup')
    expect(parsed.keys.users).toBe('{"omer":{}}')
    expect(parsed.keys['v2_userProgress_omer']).toBe('{"totalGamesPlayed":7}')
    expect(parsed.keys.cloudToken).toBeUndefined()

    localStorage.clear()
    const result = restoreBackup(json)
    expect(result.success).toBe(true)
    expect(result.keysRestored).toBe(2)
    expect(localStorage.getItem('v2_userProgress_omer')).toBe('{"totalGamesPlayed":7}')
    expect(localStorage.getItem('cloudToken')).toBeNull()
  })

  it('rejects invalid json and wrong format without touching storage', () => {
    localStorage.setItem('users', 'keep-me')
    expect(restoreBackup('not json').error).toBe('invalid-json')
    expect(restoreBackup('{"format":"other","keys":{}}').error).toBe('invalid-format')
    expect(restoreBackup('{"format":"english-learning-backup"}').error).toBe('invalid-format')
    expect(localStorage.getItem('users')).toBe('keep-me')
  })
})
