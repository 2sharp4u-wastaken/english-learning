import { Brain, Ear, Eye, Mic, Pencil, type LucideIcon } from 'lucide-react'
import type { WJStageId } from '@/bridge/word-journey'

/**
 * Word Journey stage → `lucide-react` glyph. Single source of truth so the
 * in-game stage bar (`WJStageBar`) and the Stats journey pills render the same
 * device-consistent icons instead of duplicating emoji. Icons inherit
 * `currentColor`, so each render site colors them per stage state.
 */
export const WJ_STAGE_ICONS: Record<WJStageId, LucideIcon> = {
  discover: Eye,
  'listen-match': Ear,
  'spell-tiles': Pencil,
  'say-word': Mic,
  recall: Brain,
}
