// Slang — modern/casual English slang for Hebrew-speaking children (ages 5–8).
// Part of Phase 5 (Content Expansion). Data-only: no game consumes this yet (Slice 5.1).
//
// IMPORTANT: slang is REGISTER-GATED. Each entry is 'casual' (mild, widely
// acceptable) or 'edgy' (trendy teen slang some families would rather skip).
// Both registers are OFF by default (kid-friendly only); a parent opts in per
// register in Settings (Slice 5.2). The bridge filters by enabled register.
//
// Entry shape (see src/bridge/expressions.ts): phrase / type / register /
// meaningHe / meaningHeOptions / literalHe? / exampleEn / exampleHe / difficulty.
//
// meaningHeOptions[0] ships as meaningHe; the rest are alternatives. Change a
// meaning via the in-app Settings -> ביטויים editor (Slice 5.2, expressionMeaningOverrides).

function sl(phrase, register, meaningHeOptions, exampleEn, exampleHe, difficulty, literalHe) {
    return {
        phrase,
        type: 'slang',
        register,
        meaningHe: meaningHeOptions[0],
        meaningHeOptions,
        ...(literalHe ? { literalHe } : {}),
        exampleEn,
        exampleHe,
        difficulty,
    };
}

export const slang = [
    // ── casual: mild, everyday slang ────────────────────────────────────────
    sl('totally', 'casual',
        ['לגמרי', 'בהחלט', 'אין ספק'],
        "Totally! Let's go to the park.",
        'לגמרי! בוא נלך לפארק.',
        'intermediate'),

    sl('awesome', 'casual',
        ['מדהים', 'אדיר', 'פצצה'],
        'We had an awesome day at the beach.',
        'היה לנו יום מדהים בים.',
        'beginner'),

    sl('no way', 'casual',
        ['אין מצב', 'לא יכול להיות', 'בחיים לא'],
        'No way, you got a puppy?!',
        'אין מצב, קיבלת גור?!',
        'beginner'),

    sl('for real', 'casual',
        ['ברצינות', 'באמת', 'בלי צחוק'],
        'For real, I finished the whole book!',
        'ברצינות, סיימתי את כל הספר!',
        'intermediate'),

    sl('my bad', 'casual',
        ['אשמתי', 'סליחה, טעות שלי', 'טעיתי'],
        'My bad, I took your pencil by mistake.',
        'אשמתי, לקחתי את העיפרון שלך בטעות.',
        'intermediate'),

    sl('hang out', 'casual',
        ['לבלות יחד', 'להסתובב יחד', 'להעביר זמן ביחד'],
        'Do you want to hang out after school?',
        'בא לך לבלות אחרי בית הספר?',
        'intermediate'),

    sl('chill', 'casual',
        ['להירגע', 'לנוח בנחת', 'לקחת בקלות'],
        "Let's just chill at home today.",
        'בוא פשוט ננוח בבית היום.',
        'intermediate'),

    sl("what's up", 'casual',
        ['מה קורה?', 'מה נשמע?', 'מה העניינים?'],
        "Hey, what's up?",
        'היי, מה קורה?',
        'beginner'),

    sl('gotcha', 'casual',
        ['הבנתי', 'תפסתי', 'קלטתי'],
        "Gotcha, I understand now.",
        'הבנתי, עכשיו זה ברור לי.',
        'intermediate'),

    sl('yum', 'casual',
        ['איזה טעים!', 'טעים!', 'אמ-אמ'],
        'Yum! Chocolate cake!',
        'איזה טעים! עוגת שוקולד!',
        'beginner'),

    sl('oops', 'casual',
        ['אופס', 'אוי', 'אוף'],
        'Oops, I dropped the spoon.',
        'אופס, הפלתי את הכף.',
        'beginner'),

    sl('super', 'casual',
        ['סופר', 'על', 'מאוד מאוד'],
        'You did a super job!',
        'עשית עבודה סופר!',
        'beginner'),

    sl('buddy', 'casual',
        ['חבר', 'אחי', 'ידיד'],
        'Thanks for the help, buddy!',
        'תודה על העזרה, חבר!',
        'beginner'),

    sl('epic', 'casual',
        ['אדיר', 'אגדי', 'ענק'],
        'That was an epic goal!',
        'זה היה גול אדיר!',
        'intermediate'),

    // ── edgy: trendy teen slang (opt-in) ────────────────────────────────────
    sl('no cap', 'edgy',
        ['בלי לשקר', 'באמת באמת', 'אני רציני'],
        "That movie was the best, no cap.",
        'הסרט הזה היה הכי טוב, בלי לשקר.',
        'advanced'),

    sl("that's fire", 'edgy',
        ['זה אש', 'זה מהמם', 'זה פצצה'],
        "Your new shoes? That's fire!",
        'הנעליים החדשות שלך? זה אש!',
        'advanced'),

    sl('lit', 'edgy',
        ['אש', 'מהמם', 'על הכיפק'],
        'The party was lit!',
        'המסיבה הייתה אש!',
        'advanced'),

    sl('got beef', 'edgy',
        ['יש ריב', 'יש ביניהם בעיה', 'מסוכסכים'],
        'Those two have beef since last week.',
        'לשניים האלה יש ריב מאז שבוע שעבר.',
        'advanced'),

    sl('salty', 'edgy',
        ['נעלב וכועס', 'מריר', 'ברוגז'],
        "He's salty because he lost the game.",
        'הוא ברוגז כי הוא הפסיד במשחק.',
        'advanced'),

    sl('flex', 'edgy',
        ['להשוויץ', 'להתרברב', 'להציג בגאווה'],
        "Stop flexing your new toys.",
        'תפסיק להשוויץ עם הצעצועים החדשים שלך.',
        'advanced'),

    sl('sus', 'edgy',
        ['חשוד', 'מעורר חשד', 'משהו פה לא ברור'],
        "That's a little sus, don't you think?",
        'זה קצת חשוד, לא?',
        'advanced'),

    sl('vibe', 'edgy',
        ['אווירה', 'תחושה', 'ראש'],
        'This place has a good vibe.',
        'למקום הזה יש אווירה טובה.',
        'advanced'),

    sl('slay', 'edgy',
        ['לקרוע', 'להצליח בגדול', 'להרשים'],
        'You really slayed that dance!',
        'ממש קרעת בריקוד הזה!',
        'advanced'),

    sl('bet', 'edgy',
        ['סבבה', 'מקובל', 'סגור'],
        '"Want to play?" "Bet!"',
        '"בא לך לשחק?" "סבבה!"',
        'advanced'),

    sl('legit', 'edgy',
        ['אמיתי', 'רציני', 'ממש'],
        'That trick was legit amazing.',
        'הטריק הזה היה ממש מדהים.',
        'advanced'),

    sl('cringe', 'edgy',
        ['מביך', 'גורם לאי-נוחות', 'מעורר מבוכה'],
        "That joke was so cringe.",
        'הבדיחה הזאת הייתה כל כך מביכה.',
        'advanced'),

    sl('hyped', 'edgy',
        ['מתרגש', 'נלהב', 'על הקצה מהתרגשות'],
        "I'm so hyped for the trip!",
        'אני כל כך מתרגש לקראת הטיול!',
        'advanced'),

    sl('ghosted', 'edgy',
        ['נעלם בלי הסבר', 'הפסיק לדבר פתאום', 'התנדף'],
        "He ghosted us and never replied.",
        'הוא נעלם לנו ולא ענה יותר.',
        'advanced'),

    sl('lowkey', 'edgy',
        ['קצת', 'בשקט', 'באופן מאופק'],
        "I lowkey want some ice cream.",
        'בא לי קצת גלידה.',
        'advanced'),

    sl('the GOAT', 'edgy',
        ['הכי טוב בכל הזמנים', 'אלוף האלופים', 'מספר אחת אי פעם'],
        'That player is the GOAT.',
        'השחקן הזה הוא הכי טוב בכל הזמנים.',
        'advanced', 'העז (ראשי תיבות: הגדול בכל הזמנים)'),
];
