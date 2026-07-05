import { useEffect, useState } from 'react'
import { getSaveFailed, onStorageHealthChange } from '@/bridge/storageHealth'

/** Whether progress saves are currently failing (quota / privacy mode). */
export function useStorageHealth(): { saveFailed: boolean } {
  const [saveFailed, setSaveFailed] = useState(getSaveFailed)
  useEffect(() => onStorageHealthChange(setSaveFailed), [])
  return { saveFailed }
}
