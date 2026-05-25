// Phonics Data — multi-letter sounds (digraphs + vowel teams) for ages 5–8.
//
// Unlike abcData.js (which teaches letter *names*: ay, bee, see), this teaches
// the *sound* a letter combination makes (sh → 🚢 ship, ee → 🐝 bee). Mastery is
// tracked per sound under the key `<sound>_phonics` (e.g. "sh_phonics"), exactly
// mirroring ABC's `<letter>_abc` model so the same mastery-driven selection and
// "all mastered → congratulations" flow applies.
//
// Three question subtypes (one page renders all three, ABC-style):
//   - hear-pick-word  : show the digraph + hear an example → tap the picture
//                       whose name has that sound (distractors are other sounds)
//   - see-pick-sound  : show a picture+word + hear it → choose which sound it has
//   - say-sound       : show the digraph + example word → say it (mic, lenient)

// Each sound: `sound` is the mastery key base + the displayed grapheme; `type`
// groups digraph vs vowel-team (cosmetic for now); `hebrewSound` is a short
// Hebrew gloss shown as a hint; `words` are example words that contain the sound
// (used both as the spoken anchor and as correct/distractor picture options).
export const phonicsSounds = [
    // ── Consonant digraphs ───────────────────────────────────────────────────
    { sound: 'sh', type: 'digraph', hebrewSound: 'הצליל שְׁ (כמו "שֶׁלֶג")', words: [
        { word: 'ship', emoji: '🚢' }, { word: 'fish', emoji: '🐟' },
        { word: 'sheep', emoji: '🐑' }, { word: 'shoe', emoji: '👟' },
        { word: 'shell', emoji: '🐚' }, { word: 'shark', emoji: '🦈' },
    ] },
    { sound: 'ch', type: 'digraph', hebrewSound: 'הצליל צ׳ (כמו "צ׳יפס")', words: [
        { word: 'cheese', emoji: '🧀' }, { word: 'chair', emoji: '🪑' },
        { word: 'cherry', emoji: '🍒' }, { word: 'chicken', emoji: '🐔' },
        { word: 'chips', emoji: '🍟' }, { word: 'cheetah', emoji: '🐆' },
    ] },
    { sound: 'th', type: 'digraph', hebrewSound: 'הצליל ת׳ (הלשון בין השיניים)', words: [
        { word: 'thumb', emoji: '👍' }, { word: 'tooth', emoji: '🦷' },
        { word: 'three', emoji: '3️⃣' }, { word: 'bath', emoji: '🛁' },
        { word: 'thunder', emoji: '⛈️' },
    ] },
    { sound: 'ph', type: 'digraph', hebrewSound: 'הצליל פ (נשמע כמו f)', words: [
        { word: 'phone', emoji: '📱' }, { word: 'photo', emoji: '📷' },
        { word: 'elephant', emoji: '🐘' }, { word: 'dolphin', emoji: '🐬' },
    ] },
    { sound: 'wh', type: 'digraph', hebrewSound: 'הצליל ו (w)', words: [
        { word: 'whale', emoji: '🐋' }, { word: 'wheel', emoji: '☸️' },
        { word: 'white', emoji: '⬜' }, { word: 'wheat', emoji: '🌾' },
    ] },
    { sound: 'ck', type: 'digraph', hebrewSound: 'הצליל ק (בסוף מילה)', words: [
        { word: 'duck', emoji: '🦆' }, { word: 'sock', emoji: '🧦' },
        { word: 'clock', emoji: '🕐' }, { word: 'rock', emoji: '🪨' },
        { word: 'truck', emoji: '🚚' },
    ] },
    { sound: 'ng', type: 'digraph', hebrewSound: 'הצליל נְג (בסוף מילה)', words: [
        { word: 'ring', emoji: '💍' }, { word: 'king', emoji: '🤴' },
        { word: 'wing', emoji: '🪽' }, { word: 'song', emoji: '🎵' },
    ] },

    // ── Vowel teams ──────────────────────────────────────────────────────────
    { sound: 'ee', type: 'vowel-team', hebrewSound: 'הצליל אִי הארוך', words: [
        { word: 'bee', emoji: '🐝' }, { word: 'tree', emoji: '🌳' },
        { word: 'feet', emoji: '👣' }, { word: 'queen', emoji: '👸' },
        { word: 'green', emoji: '🟢' },
    ] },
    { sound: 'oo', type: 'vowel-team', hebrewSound: 'הצליל אוּ', words: [
        { word: 'moon', emoji: '🌙' }, { word: 'book', emoji: '📚' },
        { word: 'food', emoji: '🍔' }, { word: 'spoon', emoji: '🥄' },
        { word: 'foot', emoji: '🦶' },
    ] },
    { sound: 'ai', type: 'vowel-team', hebrewSound: 'הצליל אֵיי', words: [
        { word: 'rain', emoji: '🌧️' }, { word: 'train', emoji: '🚂' },
        { word: 'snail', emoji: '🐌' }, { word: 'paint', emoji: '🎨' },
    ] },
    { sound: 'oa', type: 'vowel-team', hebrewSound: 'הצליל אוֹ הארוך', words: [
        { word: 'boat', emoji: '⛵' }, { word: 'goat', emoji: '🐐' },
        { word: 'coat', emoji: '🧥' }, { word: 'soap', emoji: '🧼' },
        { word: 'toast', emoji: '🍞' },
    ] },
    { sound: 'ea', type: 'vowel-team', hebrewSound: 'הצליל אִי', words: [
        { word: 'leaf', emoji: '🍃' }, { word: 'sea', emoji: '🌊' },
        { word: 'tea', emoji: '🍵' }, { word: 'peach', emoji: '🍑' },
        { word: 'beach', emoji: '🏖️' },
    ] },
    { sound: 'ay', type: 'vowel-team', hebrewSound: 'הצליל אֵיי (בסוף מילה)', words: [
        { word: 'day', emoji: '☀️' }, { word: 'subway', emoji: '🚇' },
        { word: 'tray', emoji: '🍽️' }, { word: 'crayon', emoji: '🖍️' },
    ] },
];

// ── Mastery helpers (mirror abcData.js exactly) ───────────────────────────────

function getSoundMastery(sound) {
    if (!window.app || !window.app.userProgress || !window.app.userProgress.wordMastery) {
        return 0;
    }
    const stats = window.app.userProgress.wordMastery[`${sound}_phonics`];
    return stats?.masteryLevel || 0;
}

export function areAllSoundsMastered() {
    return phonicsSounds.every(s => getSoundMastery(s.sound) >= 0.8);
}

export function getUnmasteredSoundCount() {
    return phonicsSounds.filter(s => getSoundMastery(s.sound) < 0.8).length;
}

// ── Small utilities ───────────────────────────────────────────────────────────

function shuffle(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
}

function pickWord(soundData) {
    return soundData.words[Math.floor(Math.random() * soundData.words.length)];
}

// Pick `n` distractor sounds (objects) other than `exclude`.
function otherSounds(exclude, n) {
    return shuffle(phonicsSounds.filter(s => s.sound !== exclude)).slice(0, n);
}

// ── Question generators ───────────────────────────────────────────────────────

// hear-pick-word: show the digraph, hear an example word, tap the picture whose
// name has that sound. Distractors are example words from OTHER sounds, so the
// child must isolate the target sound (not just match a word to a picture).
function generateHearPickWord(soundData) {
    const correctWord = pickWord(soundData);
    const distractors = otherSounds(soundData.sound, 3).map(s => pickWord(s));
    const optionItems = shuffle([{ ...correctWord, _correct: true }, ...distractors]);
    const options = optionItems.map(o => ({ word: o.word, emoji: o.emoji }));
    const correct = optionItems.findIndex(o => o._correct);

    return {
        type: 'hear-pick-word',
        questionType: 'phonics',
        sound: soundData.sound,
        display: soundData.sound,
        hebrewSound: soundData.hebrewSound,
        sayWord: correctWord.word.toLowerCase(),
        emoji: correctWord.emoji,
        options,
        correct,
        category: 'phonics',
        word: soundData.sound, // mastery tracking → `<sound>_phonics`
        instruction: 'הקשב — איזו תמונה מתחילה בצליל הזה?',
        instructionEn: 'Listen — which picture has this sound?',
    };
}

// see-pick-sound: show a picture+word, hear it, choose which sound it contains.
// Options are sound labels (digraphs) with a Hebrew gloss as a sublabel.
function generateSeePickSound(soundData) {
    const promptWord = pickWord(soundData);
    const distractors = otherSounds(soundData.sound, 2);
    const optionItems = shuffle([{ ...soundData, _correct: true }, ...distractors]);
    const options = optionItems.map(s => ({ label: s.sound, sublabel: s.hebrewSound }));
    const correct = optionItems.findIndex(s => s._correct);

    return {
        type: 'see-pick-sound',
        questionType: 'phonics',
        sound: soundData.sound,
        display: soundData.sound,
        hebrewSound: soundData.hebrewSound,
        sayWord: promptWord.word.toLowerCase(),
        promptWord: promptWord.word,
        emoji: promptWord.emoji,
        options,
        correct,
        category: 'phonics',
        word: soundData.sound,
        instruction: 'הקשב — איזה צליל יש במילה?',
        instructionEn: 'Listen — which sound is in the word?',
    };
}

// say-sound: show the digraph + example word, say it. Mic + lenient match (bridge).
function generateSaySound(soundData) {
    const promptWord = pickWord(soundData);
    return {
        type: 'say-sound',
        questionType: 'phonics',
        sound: soundData.sound,
        display: soundData.sound,
        hebrewSound: soundData.hebrewSound,
        sayWord: promptWord.word.toLowerCase(),
        promptWord: promptWord.word,
        emoji: promptWord.emoji,
        category: 'phonics',
        word: soundData.sound,
        instruction: 'אמור את המילה בקול',
        instructionEn: 'Say the word out loud',
    };
}

// Mastery-driven session builder. Filters mastered sounds (≥ 0.8) and returns []
// once every sound is mastered (page shows congratulations). Pairs each sound
// with varied subtypes before repeating — same variety loop as generateABCQuestions.
export function generatePhonicsQuestions(count = 15) {
    const questionTypes = ['hear-pick-word', 'see-pick-sound', 'say-sound'];
    const unmastered = phonicsSounds.filter(s => getSoundMastery(s.sound) < 0.8);

    if (unmastered.length === 0) {
        console.log('[Phonics] All sounds mastered! Returning empty questions.');
        return [];
    }
    console.log(`[Phonics] ${unmastered.length} unmastered sounds remaining`);

    // Lowest mastery first (prioritise struggling sounds), tie-break random.
    const byMastery = [...unmastered].sort((a, b) => {
        const ma = getSoundMastery(a.sound);
        const mb = getSoundMastery(b.sound);
        if (ma !== mb) return ma - mb;
        return Math.random() - 0.5;
    });

    const typeUsage = {};
    byMastery.forEach(s => { typeUsage[s.sound] = new Set(); });

    const numTypes = questionTypes.length;
    const maxWithVariety = Math.min(count, byMastery.length * 2); // each sound ≤ 2 appearances
    const actualCount = Math.max(9, maxWithVariety);

    const questions = [];
    let lastSound = null;

    for (let i = 0; i < actualCount; i++) {
        let available = byMastery.filter(s =>
            typeUsage[s.sound].size < numTypes && s.sound !== lastSound,
        );
        if (available.length === 0) available = byMastery.filter(s => s.sound !== lastSound);
        if (available.length === 0) available = [...byMastery];

        // 70% weight toward the lower-mastery half.
        const cutoff = Math.ceil(available.length / 2);
        const pool = Math.random() < 0.7 && cutoff > 0 ? available.slice(0, cutoff) : available;
        const soundData = pool[Math.floor(Math.random() * pool.length)];
        lastSound = soundData.sound;

        let availableTypes = questionTypes.filter(t => !typeUsage[soundData.sound].has(t));
        if (availableTypes.length === 0) availableTypes = [...questionTypes];
        const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        typeUsage[soundData.sound].add(type);

        let question;
        switch (type) {
            case 'hear-pick-word': question = generateHearPickWord(soundData); break;
            case 'see-pick-sound': question = generateSeePickSound(soundData); break;
            case 'say-sound': question = generateSaySound(soundData); break;
        }
        questions.push(question);
    }

    return questions;
}
