// Phrasal verbs — kid-friendly English phrasal verbs for Hebrew-speaking children
// (ages 5–8). Part of Phase 5 (Content Expansion). Data-only: no game consumes
// this yet (Slice 5.1).
//
// Entry shape (see src/bridge/expressions.ts for the typed contract):
//   - phrase / type / register / meaningHe / meaningHeOptions / literalHe? /
//     exampleEn / exampleHe / difficulty
// (same fields as data/expressions/idioms.js — see that file's header for details).
//
// meaningHeOptions[0] is my recommended pick; see docs/expression-review.md to choose.

function pv(phrase, meaningHeOptions, exampleEn, exampleHe, difficulty, literalHe) {
    return {
        phrase,
        type: 'phrasal-verb',
        register: 'kid-friendly',
        meaningHe: meaningHeOptions[0],
        meaningHeOptions,
        ...(literalHe ? { literalHe } : {}),
        exampleEn,
        exampleHe,
        difficulty,
    };
}

export const phrasalVerbs = [
    pv('give up',
        ['לוותר', 'להרים ידיים', 'להתייאש'],
        "Don't give up on your dreams.",
        'אל תוותר על החלומות שלך.',
        'beginner'),

    pv('put on',
        ['ללבוש', 'להרכיב', 'לשים על הגוף'],
        'Put on your coat, it is cold outside.',
        'תלבש את המעיל, קר בחוץ.',
        'beginner'),

    pv('take off',
        ['להוריד (בגד)', 'לפשוט', 'להסיר'],
        'Take off your shoes before you come in.',
        'תוריד את הנעליים לפני שאתה נכנס.',
        'beginner'),

    pv('look after',
        ['לטפל ב', 'לשמור על', 'לדאוג ל'],
        'Can you look after my dog this weekend?',
        'תוכל לשמור על הכלב שלי בסוף השבוע?',
        'intermediate'),

    pv('pick up',
        ['להרים', 'לאסוף', 'להגביה מהרצפה'],
        'Please pick up the toys from the floor.',
        'בבקשה תרים את הצעצועים מהרצפה.',
        'beginner'),

    pv('clean up',
        ['לנקות', 'לסדר', 'לעשות סדר'],
        'Let us clean up the room together.',
        'בוא ננקה את החדר ביחד.',
        'beginner'),

    pv('sit down',
        ['לשבת', 'להתיישב', 'לקחת מקום'],
        'Please sit down and open your book.',
        'בבקשה שב ופתח את הספר.',
        'beginner'),

    pv('stand up',
        ['לקום', 'לעמוד', 'להתרומם'],
        'Stand up when the teacher comes in.',
        'תקום כשהמורה נכנסת.',
        'beginner'),

    pv('wake up',
        ['להתעורר', 'להקיץ משינה', 'לפקוח עיניים'],
        'I wake up at seven every morning.',
        'אני מתעורר בשבע כל בוקר.',
        'beginner'),

    pv('get up',
        ['לקום מהמיטה', 'להתרומם', 'לצאת מהמיטה'],
        'It is late, time to get up!',
        'מאוחר, הגיע הזמן לקום!',
        'beginner'),

    pv('turn on',
        ['להדליק', 'להפעיל', 'לפתוח (מכשיר)'],
        'Can you turn on the light, please?',
        'תוכל להדליק את האור, בבקשה?',
        'beginner'),

    pv('turn off',
        ['לכבות', 'לסגור (מכשיר)', 'להפסיק'],
        'Turn off the TV and go to sleep.',
        'תכבה את הטלוויזיה ולך לישון.',
        'beginner'),

    pv('put away',
        ['להחזיר למקום', 'לסדר בחזרה', 'לאחסן'],
        'Put away your clothes in the closet.',
        'תחזיר את הבגדים לארון.',
        'intermediate'),

    pv('throw away',
        ['לזרוק לפח', 'להשליך', 'להיפטר מ'],
        "Throw away the paper, it's trash.",
        'תזרוק את הנייר, זה זבל.',
        'beginner'),

    pv('look for',
        ['לחפש', 'לנסות למצוא', 'לתור אחרי'],
        'I am looking for my other sock.',
        'אני מחפש את הגרב השנייה שלי.',
        'beginner'),

    pv('find out',
        ['לגלות', 'לברר', 'לדעת לבסוף'],
        "Let's find out who wins the game.",
        'בוא נגלה מי מנצח במשחק.',
        'intermediate'),

    pv('grow up',
        ['לגדול', 'להתבגר', 'להיות גדול'],
        'When I grow up, I want to be a pilot.',
        'כשאהיה גדול, אני רוצה להיות טייס.',
        'beginner'),

    pv('run away',
        ['לברוח', 'להימלט', 'לרוץ ולהסתלק'],
        'The cat ran away when the dog barked.',
        'החתול ברח כשהכלב נבח.',
        'intermediate'),

    pv('come back',
        ['לחזור', 'לשוב', 'להגיע בחזרה'],
        'Come back home before dark.',
        'תחזור הביתה לפני שיחשיך.',
        'beginner'),

    pv('go away',
        ['ללכת', 'להסתלק', 'להתרחק'],
        'The rain went away and the sun came out.',
        'הגשם פסק והשמש יצאה.',
        'beginner'),

    pv('wait for',
        ['לחכות ל', 'להמתין ל', 'לצפות ל'],
        'Wait for me at the gate.',
        'חכה לי ליד השער.',
        'beginner'),

    pv('hurry up',
        ['למהר', 'להזדרז', 'לזוז מהר'],
        'Hurry up, we are going to be late!',
        'תמהר, אנחנו עומדים לאחר!',
        'beginner'),

    pv('calm down',
        ['להירגע', 'להרגיע', 'להוריד הילוך'],
        'Calm down, everything is okay.',
        'תירגע, הכול בסדר.',
        'intermediate'),

    pv('cheer up',
        ['להתעודד', 'לשמח', 'להרים את מצב הרוח'],
        'Cheer up, tomorrow will be better!',
        'תתעודד, מחר יהיה יותר טוב!',
        'intermediate'),

    pv('dress up',
        ['להתחפש', 'להתלבש יפה', 'להתקשט'],
        'We dress up for the costume party.',
        'אנחנו מתחפשים למסיבת התחפושות.',
        'intermediate'),

    pv('eat up',
        ['לאכול הכול', 'לחסל את האוכל', 'לסיים לאכול'],
        'Eat up your vegetables, please.',
        'תאכל את כל הירקות, בבקשה.',
        'beginner'),

    pv('write down',
        ['לרשום', 'לכתוב', 'להעלות על הכתב'],
        'Write down your name on the paper.',
        'תרשום את השם שלך על הדף.',
        'beginner'),

    pv('fill in',
        ['למלא (חסר)', 'להשלים', 'למלא טופס'],
        'Fill in the missing letters.',
        'תמלא את האותיות החסרות.',
        'intermediate'),

    pv('cut out',
        ['לגזור', 'לחתוך ולהוציא', 'לגזור בעזרת מספריים'],
        'Cut out the star with the scissors.',
        'תגזור את הכוכב עם המספריים.',
        'intermediate'),

    pv('put together',
        ['להרכיב', 'לחבר חלקים', 'לבנות'],
        'We put together the puzzle in an hour.',
        'הרכבנו את הפאזל בשעה.',
        'intermediate'),

    pv('hold on',
        ['לחכות רגע', 'להחזיק חזק', 'להמתין'],
        'Hold on, I am almost ready.',
        'חכה רגע, אני כמעט מוכן.',
        'intermediate'),

    pv('get along',
        ['להסתדר יחד', 'לחיות בשלום', 'להיות חברים'],
        'My sister and I get along very well.',
        'אחותי ואני מסתדרים מצוין.',
        'advanced'),

    pv('show off',
        ['להשוויץ', 'להתרברב', 'להציג בגאווה'],
        "Don't show off, just play nicely.",
        'אל תשוויץ, פשוט שחק יפה.',
        'intermediate'),

    pv('line up',
        ['להסתדר בשורה', 'לעמוד בתור', 'להיערך בשורה'],
        'Children, please line up at the door.',
        'ילדים, בבקשה תסתדרו בשורה ליד הדלת.',
        'intermediate'),

    pv('wash up',
        ['לרחוץ ידיים', 'להתרחץ', 'לשטוף'],
        'Wash up before dinner.',
        'תרחץ ידיים לפני ארוחת הערב.',
        'beginner'),

    pv('try on',
        ['למדוד (בגד)', 'לבדוק מידה', 'ללבוש לניסיון'],
        'Try on these shoes to see if they fit.',
        'תמדוד את הנעליים האלה לראות אם מתאימות.',
        'intermediate'),

    pv('give back',
        ['להחזיר', 'להשיב', 'לתת בחזרה'],
        'Please give back my pencil.',
        'בבקשה תחזיר לי את העיפרון.',
        'beginner'),

    pv('look out',
        ['להיזהר!', 'זהירות!', 'לשים לב'],
        'Look out! There is a car coming.',
        'זהירות! מגיעה מכונית.',
        'intermediate'),

    pv('listen to',
        ['להקשיב ל', 'להאזין ל', 'לשים לב ל'],
        'Listen to the teacher carefully.',
        'תקשיב למורה בריכוז.',
        'beginner'),

    pv('point at',
        ['להצביע על', 'להראות עם האצבע', 'לכוון אל'],
        'Point at the picture you like.',
        'תצביע על התמונה שאתה אוהב.',
        'beginner'),
];
