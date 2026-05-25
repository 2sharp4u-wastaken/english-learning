// Articles practice data — a / an / the
// For Hebrew-speaking children aged 5-9.
//
// Shape mirrors data/grammarQuestions.js (the React blank-fill engine reads it):
//   - sentence:        English sentence with a single "___" blank.
//   - hebrewSentence:  Full natural Hebrew translation (NO blank — Hebrew has no
//                      indefinite article, so we show the meaning, not a gloss
//                      inserted into a blank).
//   - emoji:           Visual prompt shown above the sentence (kids 5-8).
//   - options:         Always ["a", "an", "the"] in this order.
//   - hebrewOptions:   The RULE behind each option, shown as a small gloss under
//                      the English word (same index order as `options`). Teaches
//                      the rule on every question.
//   - correct:         Index into `options`.
//
// Rule taught: "a" before a consonant sound, "an" before a vowel sound, "the"
// for a specific/unique thing.

const OPTIONS = ['a', 'an', 'the'];
const HEBREW_OPTIONS = ['לפני צליל עיצור', 'לפני צליל תנועה', 'דבר מסוים / יחיד'];

function q(sentence, hebrewSentence, emoji, correct, hebrewExplanation) {
    return {
        sentence,
        hebrewSentence,
        emoji,
        options: [...OPTIONS],
        hebrewOptions: [...HEBREW_OPTIONS],
        correct,
        category: 'articles',
        hebrewExplanation,
        difficulty: 'beginner',
    };
}

export const articlesQuestions = [
    // ── "a" — consonant sound ────────────────────────────────────────────────
    q('I have ___ cat.',        'יש לי חתול.',            '🐱', 0, 'משתמשים ב-"a" לפני מילה שמתחילה בצליל עיצור (cat).'),
    q('He has ___ dog.',        'יש לו כלב.',             '🐶', 0, 'משתמשים ב-"a" לפני צליל עיצור (dog).'),
    q('I want ___ banana.',     'אני רוצה בננה.',          '🍌', 0, 'משתמשים ב-"a" לפני צליל עיצור (banana).'),
    q('I read ___ book.',       'אני קורא ספר.',           '📖', 0, 'משתמשים ב-"a" לפני צליל עיצור (book).'),
    q('I rode ___ bike.',       'רכבתי על אופניים.',       '🚲', 0, 'משתמשים ב-"a" לפני צליל עיצור (bike).'),

    // ── "an" — vowel sound ───────────────────────────────────────────────────
    q('She eats ___ apple.',    'היא אוכלת תפוח.',         '🍎', 1, 'משתמשים ב-"an" לפני צליל תנועה (apple).'),
    q('I see ___ elephant.',    'אני רואה פיל.',           '🐘', 1, 'משתמשים ב-"an" לפני צליל תנועה (elephant).'),
    q('We need ___ umbrella.',  'אנחנו צריכים מטרייה.',    '☂️', 1, 'משתמשים ב-"an" לפני צליל תנועה (umbrella).'),
    q('She is ___ astronaut.',  'היא אסטרונאוטית.',        '👩‍🚀', 1, 'משתמשים ב-"an" לפני צליל תנועה (astronaut).'),
    q('He drew ___ orange.',    'הוא צייר תפוז.',          '🍊', 1, 'משתמשים ב-"an" לפני צליל תנועה (orange).'),
    q('It is ___ egg.',         'זאת ביצה.',              '🥚', 1, 'משתמשים ב-"an" לפני צליל תנועה (egg).'),

    // ── "the" — specific / unique ────────────────────────────────────────────
    q('Look at ___ sun!',       'תראו את השמש!',           '☀️', 2, 'משתמשים ב-"the" לדבר יחיד ומיוחד (the sun).'),
    q('___ moon is bright.',    'הירח מאיר.',              '🌙', 2, 'משתמשים ב-"the" לדבר יחיד ומיוחד (the moon).'),
    q('Open ___ door, please.', 'תפתח את הדלת, בבקשה.',     '🚪', 2, 'משתמשים ב-"the" לדבר מסוים ששנינו מכירים (the door).'),
    q('___ teacher is nice.',   'המורה נחמדה.',            '🧑‍🏫', 2, 'משתמשים ב-"the" למורה המסוימת שלנו (the teacher).'),
];

export const articlesCategories = {
    articles: { name: 'a / an / the', icon: '📝' },
};
