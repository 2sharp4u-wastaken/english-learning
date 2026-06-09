// Idioms — kid-friendly English idioms for Hebrew-speaking children (ages 5–8).
// Part of Phase 5 (Content Expansion). Data-only: no game consumes this yet (Slice 5.1).
//
// Entry shape (see src/bridge/expressions.ts for the typed contract):
//   - phrase:          the English idiom ("piece of cake")
//   - type:            always 'idiom' here
//   - register:        always 'kid-friendly' for idioms
//   - meaningHe:       the CHOSEN figurative meaning in Hebrew (defaults to the
//                      first / recommended option until the parent picks another)
//   - meaningHeOptions: 2–3 candidate Hebrew meanings to choose from (option 0 = recommended)
//   - literalHe:       literal word-by-word Hebrew, included only when it's instructive
//   - exampleEn:       a natural English example sentence
//   - exampleHe:       the example translated to Hebrew for context
//   - difficulty:      'beginner' | 'intermediate' | 'advanced'
//
// meaningHeOptions[0] ships as meaningHe; the rest are alternatives. Change a
// meaning via the in-app Settings -> ביטויים editor (Slice 5.2, expressionMeaningOverrides).

function idiom(phrase, meaningHeOptions, exampleEn, exampleHe, difficulty, literalHe) {
    return {
        phrase,
        type: 'idiom',
        register: 'kid-friendly',
        meaningHe: meaningHeOptions[0],
        meaningHeOptions,
        ...(literalHe ? { literalHe } : {}),
        exampleEn,
        exampleHe,
        difficulty,
    };
}

export const idioms = [
    idiom('piece of cake',
        ['קלי קלות', 'קל מאוד', 'פשוט מאוד'],
        'The test was a piece of cake.',
        'המבחן היה קלי קלות.',
        'beginner', 'חתיכת עוגה'),

    idiom('easy peasy',
        ['קל מאוד', 'פשוט וקל', 'ממש קל'],
        'Tying my shoes is easy peasy.',
        'לקשור נעליים זה קל מאוד.',
        'beginner'),

    idiom('a walk in the park',
        ['קל מאוד', 'משחק ילדים', 'פשוט לגמרי'],
        'For her, math is a walk in the park.',
        'בשבילה, חשבון זה ממש קל.',
        'intermediate', 'טיול בפארק'),

    idiom('break a leg',
        ['בהצלחה!', 'שיהיה לך בהצלחה', 'תצליח!'],
        'You have a show tonight? Break a leg!',
        'יש לך הצגה הערב? בהצלחה!',
        'beginner', 'שבור רגל'),

    idiom('hit the books',
        ['להתחיל ללמוד', 'לשבת ללמוד', 'לצלול ללימודים'],
        'I have a big test, so I need to hit the books.',
        'יש לי מבחן גדול, אז אני צריך להתחיל ללמוד.',
        'intermediate', 'להכות את הספרים'),

    idiom('under the weather',
        ['מרגיש לא טוב', 'חולה קצת', 'לא מרגיש בטוב'],
        'I stayed home because I felt under the weather.',
        'נשארתי בבית כי הרגשתי לא טוב.',
        'intermediate'),

    idiom('once in a blue moon',
        ['לעתים רחוקות מאוד', 'אחת לזמן רב', 'כמעט אף פעם'],
        'We eat candy only once in a blue moon.',
        'אנחנו אוכלים ממתקים רק לעתים רחוקות מאוד.',
        'advanced', 'פעם בירח כחול'),

    idiom('let the cat out of the bag',
        ['לגלות סוד', 'לפלוט סוד', 'לחשוף את הסוד'],
        "Don't let the cat out of the bag about the party.",
        'אל תגלה את הסוד על המסיבה.',
        'advanced', 'לשחרר את החתול מהשק'),

    idiom('spill the beans',
        ['לגלות את הסוד', 'לפלוט הכול', 'לספר את הסוד'],
        'Come on, spill the beans! What happened?',
        'נו, גלה כבר! מה קרה?',
        'intermediate', 'לשפוך את השעועית'),

    idiom('raining cats and dogs',
        ['יורד גשם חזק מאוד', 'מבול בחוץ', 'גשם זלעפות'],
        "We can't go out — it's raining cats and dogs.",
        'אי אפשר לצאת — יורד גשם חזק מאוד.',
        'intermediate', 'יורד חתולים וכלבים'),

    idiom('couch potato',
        ['עצלן שיושב מול הטלוויזיה', 'בטלן ספה', 'מי שלא זז מהספה'],
        "Don't be a couch potato, let's play outside!",
        'אל תהיה עצלן מול הטלוויזיה, בוא נשחק בחוץ!',
        'intermediate', 'תפוח אדמה של ספה'),

    idiom('cool as a cucumber',
        ['רגוע לגמרי', 'שליו ונינוח', 'קר רוח'],
        'Even before the test, she was cool as a cucumber.',
        'אפילו לפני המבחן, היא הייתה רגועה לגמרי.',
        'advanced', 'קריר כמו מלפפון'),

    idiom('bookworm',
        ['תולעת ספרים', 'מי שאוהב מאוד לקרוא', 'חובב קריאה גדול'],
        'My sister is a bookworm — she reads every day.',
        'אחותי היא תולעת ספרים — היא קוראת כל יום.',
        'beginner', 'תולעת ספר'),

    idiom('butterflies in my stomach',
        ['פרפרים בבטן', 'לחוץ ומתרגש', 'מתח נעים בבטן'],
        'I had butterflies in my stomach before the play.',
        'היו לי פרפרים בבטן לפני ההצגה.',
        'advanced', 'פרפרים בבטן שלי'),

    idiom('when pigs fly',
        ['לעולם לא', 'זה לא יקרה לעולם', 'כשיצמחו שיניים לתרנגול'],
        'You will clean your room? Sure, when pigs fly!',
        'תנקה את החדר? בטח, לעולם לא!',
        'advanced', 'כשחזירים יעופו'),

    idiom('the apple of my eye',
        ['בבת עיני', 'היקר לי מכול', 'האהוב ביותר עליי'],
        'My little brother is the apple of my eye.',
        'אחי הקטן הוא בבת עיני.',
        'advanced', 'התפוח של העין שלי'),

    idiom('hold your horses',
        ['חכה רגע!', 'לא להיחפז', 'רגע, לאט לאט'],
        'Hold your horses, we are not ready yet!',
        'חכה רגע, אנחנו עוד לא מוכנים!',
        'intermediate', 'תחזיק את הסוסים שלך'),

    idiom('all ears',
        ['מקשיב בתשומת לב', 'כולי אוזן', 'מקשיב בריכוז'],
        'Tell me your idea, I am all ears.',
        'ספר לי את הרעיון שלך, אני כולי אוזן.',
        'intermediate', 'כולי אוזניים'),

    idiom('no big deal',
        ['לא נורא', 'זה בסדר גמור', 'שום דבר רציני'],
        'I broke a cup, but it was no big deal.',
        'שברתי כוס, אבל זה לא נורא.',
        'beginner'),

    idiom('give it a shot',
        ['לנסות', 'לתת צ׳אנס', 'לעשות ניסיון'],
        'You might like it — just give it a shot!',
        'אולי תאהב את זה — פשוט תנסה!',
        'intermediate', 'לתת לזה יריה'),

    idiom('make up your mind',
        ['להחליט', 'לקבל החלטה', 'לסכם עם עצמך'],
        'Pizza or pasta? Make up your mind!',
        'פיצה או פסטה? תחליט!',
        'intermediate'),

    idiom('good as gold',
        ['מתנהג יפה מאוד', 'ילד טוב כמו זהב', 'מקסים ומנומס'],
        'The children were good as gold at school today.',
        'הילדים התנהגו יפה מאוד בבית הספר היום.',
        'intermediate', 'טוב כמו זהב'),

    idiom('scaredy-cat',
        ['פחדן', 'מוג לב', 'פחדן קטן'],
        "Don't be a scaredy-cat, the slide is fun!",
        'אל תהיה פחדן, המגלשה כיפית!',
        'beginner', 'חתול-פחדן'),

    idiom('fingers crossed',
        ['מחזיקים אצבעות', 'מקווים לטוב', 'בתקווה שיסתדר'],
        'Fingers crossed that it does not rain tomorrow!',
        'מחזיקים אצבעות שלא ירד גשם מחר!',
        'intermediate', 'אצבעות משוכלות'),

    idiom('sweet tooth',
        ['אוהב מתוקים', 'חובב ממתקים', 'נמשך למתוק'],
        'I have a sweet tooth, so I love chocolate.',
        'אני אוהב מתוקים, אז אני מת על שוקולד.',
        'intermediate', 'שן מתוקה'),

    idiom('feeling blue',
        ['עצוב', 'מדוכדך', 'במצב רוח נמוך'],
        'She was feeling blue after her friend moved away.',
        'היא הייתה עצובה אחרי שחברה שלה עברה דירה.',
        'intermediate', 'מרגיש כחול'),

    idiom('in hot water',
        ['בצרות', 'בצרה גדולה', 'בבעיה'],
        'He was in hot water for breaking the window.',
        'הוא היה בצרות בגלל ששבר את החלון.',
        'advanced', 'במים חמים'),

    idiom('a long face',
        ['פרצוף עצוב', 'פנים נפולות', 'מבט עצוב'],
        'Why the long face? Cheer up!',
        'למה הפרצוף העצוב? תתעודד!',
        'intermediate', 'פרצוף ארוך'),

    idiom('out of the blue',
        ['פתאום', 'בלי שום אזהרה', 'משום מקום'],
        'Out of the blue, my old friend called me.',
        'פתאום, חבר ותיק שלי התקשר אליי.',
        'advanced', 'מתוך הכחול'),

    idiom('see eye to eye',
        ['להסכים', 'לראות עין בעין', 'לחשוב אותו דבר'],
        'My brother and I see eye to eye about pizza.',
        'אחי ואני מסכימים לגבי פיצה.',
        'advanced', 'לראות עין אל עין'),

    idiom('head in the clouds',
        ['חולם בהקיץ', 'הראש בעננים', 'מרחף'],
        'Pay attention! Your head is in the clouds.',
        'תשים לב! הראש שלך בעננים.',
        'advanced', 'ראש בעננים'),

    idiom('down to earth',
        ['עם רגליים על הקרקע', 'צנוע ופשוט', 'מציאותי'],
        'She is famous but very down to earth.',
        'היא מפורסמת אבל מאוד עם הרגליים על הקרקע.',
        'advanced', 'יורד לאדמה'),

    idiom('two peas in a pod',
        ['דומים מאוד', 'כמו תאומים', 'בלתי נפרדים'],
        'The twins are like two peas in a pod.',
        'התאומים דומים מאוד זה לזה.',
        'advanced', 'שני אפונים בתרמיל'),

    idiom('break the ice',
        ['לשבור את הקרח', 'להפיג מתח', 'לפתוח בשיחה'],
        'He told a joke to break the ice with the new kids.',
        'הוא סיפר בדיחה כדי לשבור את הקרח עם הילדים החדשים.',
        'advanced', 'לשבור את הקרח'),

    idiom('lend a hand',
        ['לעזור', 'להושיט יד', 'לתת עזרה'],
        'Can you lend a hand with the dishes?',
        'תוכל לעזור עם הכלים?',
        'intermediate', 'להשאיל יד'),

    idiom('hit the hay',
        ['ללכת לישון', 'לפרוש לישון', 'לקפוץ למיטה'],
        "I'm so tired, time to hit the hay.",
        'אני כל כך עייף, הגיע הזמן ללכת לישון.',
        'advanced', 'להכות את החציר'),

    idiom('busy as a bee',
        ['עסוק מאוד', 'חרוץ כמו דבורה', 'לא מפסיק לרגע'],
        'Mom was busy as a bee all morning.',
        'אמא הייתה עסוקה מאוד כל הבוקר.',
        'intermediate', 'עסוק כמו דבורה'),

    idiom('quiet as a mouse',
        ['שקט מאוד', 'שקט כמו עכבר', 'בלי להשמיע קול'],
        'The baby is sleeping, so be quiet as a mouse.',
        'התינוק ישן, אז תהיה שקט מאוד.',
        'intermediate', 'שקט כמו עכבר'),

    idiom('a bad apple',
        ['תפוח רקוב', 'מי שמשפיע לרעה', 'אחד שמקלקל לכולם'],
        'One bad apple started all the trouble.',
        'תפוח רקוב אחד התחיל את כל הצרות.',
        'advanced', 'תפוח רע'),

    idiom('time flies',
        ['הזמן טס', 'הזמן עף', 'הזמן רץ מהר'],
        'Time flies when we are having fun!',
        'הזמן טס כשנהנים!',
        'beginner', 'הזמן עף'),

    idiom('better late than never',
        ['מוטב מאוחר מאשר אף פעם', 'עדיף באיחור מאשר בכלל לא', 'טוב מאוחר מלא בא'],
        'You finished the puzzle — better late than never!',
        'סיימת את הפאזל — מוטב מאוחר מאשר אף פעם!',
        'advanced'),

    idiom('practice makes perfect',
        ['תרגול עושה מושלם', 'אימון משתלם', 'מי שמתאמן מצליח'],
        'Keep playing the piano — practice makes perfect.',
        'תמשיך לנגן בפסנתר — תרגול עושה מושלם.',
        'intermediate'),

    idiom('look on the bright side',
        ['לראות את הצד החיובי', 'להסתכל על החצי המלא', 'לחפש את הטוב'],
        'It rained, but look on the bright side — no school!',
        'ירד גשם, אבל תראה את הצד החיובי — אין בית ספר!',
        'advanced', 'להסתכל על הצד המואר'),

    idiom('keep your chin up',
        ['אל תתייאש', 'תרים את הראש', 'תישאר חזק'],
        'You lost the game, but keep your chin up!',
        'הפסדת במשחק, אבל אל תתייאש!',
        'advanced', 'תחזיק את הסנטר למעלה'),

    idiom('the early bird catches the worm',
        ['מי שמקדים זוכה', 'הקם מוקדם מרוויח', 'מי שמשכים ראשון מצליח'],
        'We woke up early and got the best seats — the early bird catches the worm!',
        'קמנו מוקדם ותפסנו את המקומות הכי טובים — מי שמקדים זוכה!',
        'advanced', 'הציפור המקדימה תופסת את התולעת'),

    idiom('every cloud has a silver lining',
        ['בכל דבר רע יש משהו טוב', 'אחרי הגשם בא השמש', 'תמיד יש תקווה'],
        'We missed the bus but met a friend — every cloud has a silver lining.',
        'פספסנו את האוטובוס אבל פגשנו חבר — בכל דבר רע יש משהו טוב.',
        'advanced', 'לכל ענן יש בטנה כסופה'),

    idiom('actions speak louder than words',
        ['מעשים חשובים ממילים', 'מעשים מדברים בעד עצמם', 'תוכיח במעשים'],
        "Don't just say you will help — actions speak louder than words.",
        'אל תגיד רק שתעזור — מעשים חשובים ממילים.',
        'advanced', 'מעשים מדברים חזק יותר ממילים'),

    idiom('high five',
        ['כיף (מחיאת כף)', 'תן כיף', 'מחיאת כף יד לשמחה'],
        'We won! Give me a high five!',
        'ניצחנו! תן כיף!',
        'beginner', 'חמש גבוהה'),

    idiom('snug as a bug',
        ['חמים ונעים', 'מכורבל ונוח', 'נעים כמו בקן'],
        'Under the blanket I was snug as a bug.',
        'מתחת לשמיכה הייתי חמים ונעים.',
        'advanced', 'נעים כמו חרק'),

    idiom("catch some Z's",
        ['לישון קצת', 'לתפוס תנומה', 'לנמנם'],
        "After the trip we went home to catch some Z's.",
        'אחרי הטיול הלכנו הביתה לישון קצת.',
        'advanced'),

    idiom('best of both worlds',
        ['הטוב משני העולמות', 'גם וגם', 'הכי טוב מכל הכיוונים'],
        'A house near the beach and the city is the best of both worlds.',
        'בית ליד הים וגם ליד העיר זה הטוב משני העולמות.',
        'advanced', 'הטוב של שני העולמות'),
];
