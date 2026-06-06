// Expression bank index — the single combined source for Phase 5 multi-word
// expressions (idioms + phrasal verbs + slang). Parallel to data/vocabularyBank.js;
// deliberately SEPARATE from the vocabulary bank so regular vocabulary games never
// pick up expressions (Slice 5.1 acceptance criterion).
//
// Consumed by data/_loader.js (exposes window.expressionBank) and read in React
// only through src/bridge/expressions.ts. Register filtering happens in the bridge,
// not here — this index is the full, unfiltered catalog.

import { idioms } from './idioms.js';
import { phrasalVerbs } from './phrasalVerbs.js';
import { slang } from './slang.js';

export const expressionBank = [
    ...idioms,
    ...phrasalVerbs,
    ...slang,
];

export { idioms, phrasalVerbs, slang };
