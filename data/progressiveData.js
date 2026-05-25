// Progressive (continuous) tenses practice — present & past progressive.
// For Hebrew-speaking children aged 5-9.
//
// Two sub-skills, mixed:
//   1. The -ing form:        "She is ___ an apple."  → eating
//   2. The auxiliary by time: "Now the cat ___ jumping." (is) /
//                             "Yesterday I ___ reading." (was)
//
// Shape mirrors data/grammarQuestions.js. `hebrewSentence` is a full natural
// translation (no blank). `hebrewOptions` glosses each English option and is
// shown under it (same index order as `options`). `emoji` is a kid-friendly
// visual prompt.

function q(sentence, hebrewSentence, emoji, options, hebrewOptions, correct, category, hebrewExplanation) {
    return {
        sentence,
        hebrewSentence,
        emoji,
        options,
        hebrewOptions,
        correct,
        category,
        hebrewExplanation,
        difficulty: 'beginner',
    };
}

export const progressiveQuestions = [
    // ── Present progressive — choose the -ing form ───────────────────────────
    q('The dog is ___ now.', 'הכלב רץ עכשיו.', '🐕',
        ['running', 'runs', 'ran'], ['רץ (עכשיו)', 'רץ (תמיד)', 'רץ (אתמול)'], 0,
        'present-continuous', 'עכשיו = הווה מתמשך: is + פועל עם ing (running).'),
    q('She is ___ an apple.', 'היא אוכלת תפוח.', '🍎',
        ['eating', 'eats', 'ate'], ['אוכלת (עכשיו)', 'אוכלת (תמיד)', 'אכלה (אתמול)'], 0,
        'present-continuous', 'is + eating = פעולה שקורית עכשיו.'),
    q('They are ___ soccer.', 'הם משחקים כדורגל.', '⚽',
        ['playing', 'plays', 'played'], ['משחקים (עכשיו)', 'משחק (תמיד)', 'שיחקו (אתמול)'], 0,
        'present-continuous', 'are + playing = פעולה שקורית עכשיו.'),
    q('He is ___ a book.', 'הוא קורא ספר.', '📖',
        ['reading', 'reads', 'read'], ['קורא (עכשיו)', 'קורא (תמיד)', 'קרא (אתמול)'], 0,
        'present-continuous', 'is + reading = פעולה שקורית עכשיו.'),
    q('We are ___ a song.', 'אנחנו שרים שיר.', '🎵',
        ['singing', 'sings', 'sang'], ['שרים (עכשיו)', 'שר (תמיד)', 'שרו (אתמול)'], 0,
        'present-continuous', 'are + singing = פעולה שקורית עכשיו.'),
    q('The baby is ___.', 'התינוק ישן.', '😴',
        ['sleeping', 'sleeps', 'slept'], ['ישן (עכשיו)', 'ישן (תמיד)', 'ישן (אתמול)'], 0,
        'present-continuous', 'is + sleeping = פעולה שקורית עכשיו.'),

    // ── Choose the auxiliary by the time word (present vs past) ───────────────
    q('Now the cat ___ jumping.', 'עכשיו החתול קופץ.', '🐱',
        ['is', 'was', 'are'], ['עכשיו (יחיד)', 'אתמול (יחיד)', 'עכשיו (רבים)'], 0,
        'present-continuous', '"Now" = הווה, ו-cat ביחיד: is.'),
    q('Right now they ___ running.', 'ממש עכשיו הם רצים.', '🏃',
        ['are', 'were', 'is'], ['עכשיו (רבים)', 'אתמול (רבים)', 'עכשיו (יחיד)'], 0,
        'present-continuous', '"Right now" = הווה, ו-they ברבים: are.'),
    q('Yesterday I ___ reading.', 'אתמול קראתי.', '📚',
        ['was', 'am', 'were'], ['אתמול (אני)', 'עכשיו (אני)', 'אתמול (רבים)'], 0,
        'past-progressive', '"Yesterday" = עבר, ו-I: was.'),
    q('Last night she ___ sleeping.', 'אתמול בלילה היא ישנה.', '🌙',
        ['was', 'is', 'were'], ['אתמול (יחיד)', 'עכשיו (יחיד)', 'אתמול (רבים)'], 0,
        'past-progressive', '"Last night" = עבר, ו-she ביחיד: was.'),

    // ── Past progressive — choose the -ing form after was/were ───────────────
    q('Yesterday he was ___ a bike.', 'אתמול הוא רכב על אופניים.', '🚲',
        ['riding', 'rides', 'rode'], ['רכב (אז)', 'רוכב (תמיד)', 'רכב (פעם אחת)'], 0,
        'past-progressive', 'was + riding = פעולה שנמשכה בעבר.'),
    q('They were ___ in the pool.', 'הם שחו בבריכה.', '🏊',
        ['swimming', 'swims', 'swam'], ['שחו (אז)', 'שוחה (תמיד)', 'שחה (פעם אחת)'], 0,
        'past-progressive', 'were + swimming = פעולה שנמשכה בעבר.'),
    q('I was ___ TV.', 'צפיתי בטלוויזיה.', '📺',
        ['watching', 'watches', 'watched'], ['צפיתי (אז)', 'צופה (תמיד)', 'צפה (פעם אחת)'], 0,
        'past-progressive', 'was + watching = פעולה שנמשכה בעבר.'),
    q('The birds were ___.', 'הציפורים עפו.', '🐦',
        ['flying', 'flies', 'flew'], ['עפו (אז)', 'עפה (תמיד)', 'עף (פעם אחת)'], 0,
        'past-progressive', 'were + flying = פעולה שנמשכה בעבר.'),
    q('She was ___ a cake.', 'היא הכינה עוגה.', '🎂',
        ['making', 'makes', 'made'], ['הכינה (אז)', 'מכינה (תמיד)', 'הכינה (פעם אחת)'], 0,
        'past-progressive', 'was + making = פעולה שנמשכה בעבר.'),
];

export const progressiveCategories = {
    'present-continuous': { name: 'הווה מתמשך', icon: '🏃' },
    'past-progressive': { name: 'עבר מתמשך', icon: '⏪' },
};
