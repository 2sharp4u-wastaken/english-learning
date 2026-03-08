// Sentences for Scramble & Fill-in-the-Blanks games
// For Hebrew-speaking children aged 5-9

// Sentence structure:
// - sentence: Complete English sentence
// - translation: Hebrew translation
// - words: Array of words for scramble game
// - blank: Object for fill-blanks game { position: index, options: [correct, wrong1, wrong2] }
// - theme: Category/topic
// - difficulty: "beginner" or "intermediate"

export const sentences = [
    // BEGINNER SENTENCES - Greetings & Basics (10)
    {
        sentence: "Hello, how are you?",
        translation: "שלום, מה שלומך?",
        words: ["Hello,", "how", "are", "you?"],
        blank: { position: 1, options: ["how", "what", "when"] },
        theme: "greetings",
        difficulty: "beginner"
    },
    {
        sentence: "My name is Tom.",
        translation: "שמי טום.",
        words: ["My", "name", "is", "Tom."],
        blank: { position: 1, options: ["name", "friend", "book"] },
        theme: "greetings",
        difficulty: "beginner"
    },
    {
        sentence: "Good morning!",
        translation: "בוקר טוב!",
        words: ["Good", "morning!"],
        blank: { position: 0, options: ["Good", "Bad", "Nice"] },
        theme: "greetings",
        difficulty: "beginner"
    },
    {
        sentence: "Thank you very much.",
        translation: "תודה רבה.",
        words: ["Thank", "you", "very", "much."],
        blank: { position: 0, options: ["Thank", "Please", "Sorry"] },
        theme: "greetings",
        difficulty: "beginner"
    },
    {
        sentence: "See you later!",
        translation: "נתראה אחר כך!",
        words: ["See", "you", "later!"],
        blank: { position: 2, options: ["later", "now", "never"] },
        theme: "greetings",
        difficulty: "beginner"
    },
    {
        sentence: "Nice to meet you.",
        translation: "נעים להכיר.",
        words: ["Nice", "to", "meet", "you."],
        blank: { position: 2, options: ["meet", "eat", "play"] },
        theme: "greetings",
        difficulty: "beginner"
    },
    {
        sentence: "How old are you?",
        translation: "בן כמה אתה?",
        words: ["How", "old", "are", "you?"],
        blank: { position: 1, options: ["old", "new", "young"] },
        theme: "greetings",
        difficulty: "beginner"
    },
    {
        sentence: "I am seven years old.",
        translation: "אני בן שבע.",
        words: ["I", "am", "seven", "years", "old."],
        blank: { position: 2, options: ["seven", "eleven", "three"] },
        theme: "greetings",
        difficulty: "beginner"
    },
    {
        sentence: "What is your name?",
        translation: "מה שמך?",
        words: ["What", "is", "your", "name?"],
        blank: { position: 0, options: ["What", "Where", "Who"] },
        theme: "greetings",
        difficulty: "beginner"
    },
    {
        sentence: "Goodbye, my friend!",
        translation: "להתראות, ידידי!",
        words: ["Goodbye,", "my", "friend!"],
        blank: { position: 0, options: ["Goodbye", "Hello", "Welcome"] },
        theme: "greetings",
        difficulty: "beginner"
    },

    // BEGINNER SENTENCES - Family (10)
    {
        sentence: "I love my mom.",
        translation: "אני אוהב את אמא שלי.",
        words: ["I", "love", "my", "mom."],
        blank: { position: 1, options: ["love", "hate", "see"] },
        theme: "family",
        difficulty: "beginner"
    },
    {
        sentence: "This is my dad.",
        translation: "זה אבא שלי.",
        words: ["This", "is", "my", "dad."],
        blank: { position: 3, options: ["dad", "cat", "dog"] },
        theme: "family",
        difficulty: "beginner"
    },
    {
        sentence: "My sister is five.",
        translation: "אחותי בת חמש.",
        words: ["My", "sister", "is", "five."],
        blank: { position: 1, options: ["sister", "brother", "teacher"] },
        theme: "family",
        difficulty: "beginner"
    },
    {
        sentence: "I have one brother.",
        translation: "יש לי אח אחד.",
        words: ["I", "have", "one", "brother."],
        blank: { position: 3, options: ["brother", "mother", "father"] },
        theme: "family",
        difficulty: "beginner"
    },
    {
        sentence: "My grandma is nice.",
        translation: "סבתא שלי נחמדה.",
        words: ["My", "grandma", "is", "nice."],
        blank: { position: 1, options: ["grandma", "friend", "teacher"] },
        theme: "family",
        difficulty: "beginner"
    },
    {
        sentence: "We are a family.",
        translation: "אנחנו משפחה.",
        words: ["We", "are", "a", "family."],
        blank: { position: 3, options: ["family", "school", "park"] },
        theme: "family",
        difficulty: "beginner"
    },
    {
        sentence: "My baby is crying.",
        translation: "התינוק שלי בוכה.",
        words: ["My", "baby", "is", "crying."],
        blank: { position: 3, options: ["crying", "laughing", "running"] },
        theme: "family",
        difficulty: "beginner"
    },
    {
        sentence: "Mom and dad work.",
        translation: "אמא ואבא עובדים.",
        words: ["Mom", "and", "dad", "work."],
        blank: { position: 3, options: ["work", "play", "sleep"] },
        theme: "family",
        difficulty: "beginner"
    },
    {
        sentence: "I help my family.",
        translation: "אני עוזר למשפחה שלי.",
        words: ["I", "help", "my", "family."],
        blank: { position: 1, options: ["help", "hurt", "find"] },
        theme: "family",
        difficulty: "beginner"
    },
    {
        sentence: "My uncle is funny.",
        translation: "הדוד שלי מצחיק.",
        words: ["My", "uncle", "is", "funny."],
        blank: { position: 3, options: ["funny", "sad", "angry"] },
        theme: "family",
        difficulty: "beginner"
    },

    // BEGINNER SENTENCES - Animals (10)
    {
        sentence: "The cat is black.",
        translation: "החתול שחור.",
        words: ["The", "cat", "is", "black."],
        blank: { position: 1, options: ["cat", "hat", "mat"] },
        theme: "animals",
        difficulty: "beginner"
    },
    {
        sentence: "Dogs like to play.",
        translation: "כלבים אוהבים לשחק.",
        words: ["Dogs", "like", "to", "play."],
        blank: { position: 3, options: ["play", "sleep", "cry"] },
        theme: "animals",
        difficulty: "beginner"
    },
    {
        sentence: "I see a bird.",
        translation: "אני רואה ציפור.",
        words: ["I", "see", "a", "bird."],
        blank: { position: 3, options: ["bird", "word", "book"] },
        theme: "animals",
        difficulty: "beginner"
    },
    {
        sentence: "Fish swim in water.",
        translation: "דגים שוחים במים.",
        words: ["Fish", "swim", "in", "water."],
        blank: { position: 1, options: ["swim", "fly", "run"] },
        theme: "animals",
        difficulty: "beginner"
    },
    {
        sentence: "The lion is big.",
        translation: "האריה גדול.",
        words: ["The", "lion", "is", "big."],
        blank: { position: 3, options: ["big", "small", "red"] },
        theme: "animals",
        difficulty: "beginner"
    },
    {
        sentence: "Rabbits eat carrots.",
        translation: "ארנבים אוכלים גזר.",
        words: ["Rabbits", "eat", "carrots."],
        blank: { position: 1, options: ["eat", "drink", "throw"] },
        theme: "animals",
        difficulty: "beginner"
    },
    {
        sentence: "A frog jumps high.",
        translation: "צפרדע קופצת גבוה.",
        words: ["A", "frog", "jumps", "high."],
        blank: { position: 2, options: ["jumps", "sleeps", "cries"] },
        theme: "animals",
        difficulty: "beginner"
    },
    {
        sentence: "I have a pet.",
        translation: "יש לי חיית מחמד.",
        words: ["I", "have", "a", "pet."],
        blank: { position: 3, options: ["pet", "pen", "pot"] },
        theme: "animals",
        difficulty: "beginner"
    },
    {
        sentence: "Elephants are gray.",
        translation: "פילים אפורים.",
        words: ["Elephants", "are", "gray."],
        blank: { position: 2, options: ["gray", "blue", "green"] },
        theme: "animals",
        difficulty: "beginner"
    },
    {
        sentence: "The horse runs fast.",
        translation: "הסוס רץ מהר.",
        words: ["The", "horse", "runs", "fast."],
        blank: { position: 2, options: ["runs", "walks", "sleeps"] },
        theme: "animals",
        difficulty: "beginner"
    },

    // BEGINNER SENTENCES - Food (10)
    {
        sentence: "I like apples.",
        translation: "אני אוהב תפוחים.",
        words: ["I", "like", "apples."],
        blank: { position: 1, options: ["like", "hate", "throw"] },
        theme: "food",
        difficulty: "beginner"
    },
    {
        sentence: "Pizza is yummy.",
        translation: "פיצה טעימה.",
        words: ["Pizza", "is", "yummy."],
        blank: { position: 2, options: ["yummy", "bad", "cold"] },
        theme: "food",
        difficulty: "beginner"
    },
    {
        sentence: "I eat breakfast.",
        translation: "אני אוכל ארוחת בוקר.",
        words: ["I", "eat", "breakfast."],
        blank: { position: 1, options: ["eat", "drink", "throw"] },
        theme: "food",
        difficulty: "beginner"
    },
    {
        sentence: "Milk is white.",
        translation: "חלב לבן.",
        words: ["Milk", "is", "white."],
        blank: { position: 2, options: ["white", "black", "red"] },
        theme: "food",
        difficulty: "beginner"
    },
    {
        sentence: "I want ice cream.",
        translation: "אני רוצה גלידה.",
        words: ["I", "want", "ice", "cream."],
        blank: { position: 1, options: ["want", "have", "throw"] },
        theme: "food",
        difficulty: "beginner"
    },
    {
        sentence: "Carrots are orange.",
        translation: "הגזרים כתומים",
        words: ["Carrots", "are", "orange."],
        blank: { position: 2, options: ["orange", "blue", "green"] },
        theme: "food",
        difficulty: "beginner"
    },
    {
        sentence: "I drink water.",
        translation: "אני שותה מים.",
        words: ["I", "drink", "water."],
        blank: { position: 1, options: ["drink", "eat", "throw"] },
        theme: "food",
        difficulty: "beginner"
    },
    {
        sentence: "Cookies are sweet.",
        translation: "עוגיות מתוקות.",
        words: ["Cookies", "are", "sweet."],
        blank: { position: 2, options: ["sweet", "sour", "salty"] },
        theme: "food",
        difficulty: "beginner"
    },
    {
        sentence: "I love chocolate.",
        translation: "אני אוהב שוקולד.",
        words: ["I", "love", "chocolate."],
        blank: { position: 1, options: ["love", "hate", "throw"] },
        theme: "food",
        difficulty: "beginner"
    },
    {
        sentence: "The bread is fresh.",
        translation: "הלחם טרי.",
        words: ["The", "bread", "is", "fresh."],
        blank: { position: 3, options: ["fresh", "old", "cold"] },
        theme: "food",
        difficulty: "beginner"
    },

    // BEGINNER SENTENCES - Colors & Numbers (10)
    {
        sentence: "The sky is blue.",
        translation: "השמיים כחולים.",
        words: ["The", "sky", "is", "blue."],
        blank: { position: 3, options: ["blue", "red", "green"] },
        theme: "colors",
        difficulty: "beginner"
    },
    {
        sentence: "I have two hands.",
        translation: "יש לי שתי ידיים.",
        words: ["I", "have", "two", "hands."],
        blank: { position: 2, options: ["two", "three", "five"] },
        theme: "numbers",
        difficulty: "beginner"
    },
    {
        sentence: "The sun is yellow.",
        translation: "השמש צהובה.",
        words: ["The", "sun", "is", "yellow."],
        blank: { position: 3, options: ["yellow", "blue", "black"] },
        theme: "colors",
        difficulty: "beginner"
    },
    {
        sentence: "I can count to ten.",
        translation: "אני יכול לספור עד עשר.",
        words: ["I", "can", "count", "to", "ten."],
        blank: { position: 4, options: ["ten", "two", "twenty"] },
        theme: "numbers",
        difficulty: "beginner"
    },
    {
        sentence: "Grass is green.",
        translation: "דשא ירוק.",
        words: ["Grass", "is", "green."],
        blank: { position: 2, options: ["green", "red", "blue"] },
        theme: "colors",
        difficulty: "beginner"
    },
    {
        sentence: "I see five birds.",
        translation: "אני רואה חמש ציפורים.",
        words: ["I", "see", "five", "birds."],
        blank: { position: 2, options: ["five", "four", "six"] },
        theme: "numbers",
        difficulty: "beginner"
    },
    {
        sentence: "My car is red.",
        translation: "המכונית שלי אדומה.",
        words: ["My", "car", "is", "red."],
        blank: { position: 3, options: ["red", "blue", "green"] },
        theme: "colors",
        difficulty: "beginner"
    },
    {
        sentence: "One plus one is two.",
        translation: "אחד ועוד אחד זה שניים.",
        words: ["One", "plus", "one", "is", "two."],
        blank: { position: 4, options: ["two", "three", "four"] },
        theme: "numbers",
        difficulty: "beginner"
    },
    {
        sentence: "The ball is orange.",
        translation: "הכדור כתום.",
        words: ["The", "ball", "is", "orange."],
        blank: { position: 3, options: ["orange", "purple", "pink"] },
        theme: "colors",
        difficulty: "beginner"
    },
    {
        sentence: "I am six years old.",
        translation: "אני בן שש.",
        words: ["I", "am", "six", "years", "old."],
        blank: { position: 2, options: ["six", "seven", "eight"] },
        theme: "numbers",
        difficulty: "beginner"
    },

    // BEGINNER SENTENCES - School & Daily Life (10)
    {
        sentence: "I go to school.",
        translation: "אני הולך לבית ספר.",
        words: ["I", "go", "to", "school."],
        blank: { position: 3, options: ["school", "park", "store"] },
        theme: "school",
        difficulty: "beginner"
    },
    {
        sentence: "My teacher is kind.",
        translation: "המורה שלי נחמדה.",
        words: ["My", "teacher", "is", "kind."],
        blank: { position: 1, options: ["teacher", "student", "friend"] },
        theme: "school",
        difficulty: "beginner"
    },
    {
        sentence: "I read a book.",
        translation: "אני קורא ספר.",
        words: ["I", "read", "a", "book."],
        blank: { position: 1, options: ["read", "eat", "throw"] },
        theme: "school",
        difficulty: "beginner"
    },
    {
        sentence: "The sun is shining.",
        translation: "השמש זורחת.",
        words: ["The", "sun", "is", "shining."],
        blank: { position: 3, options: ["shining", "sleeping", "crying"] },
        theme: "daily",
        difficulty: "beginner"
    },
    {
        sentence: "I play with friends.",
        translation: "אני משחק עם חברים.",
        words: ["I", "play", "with", "friends."],
        blank: { position: 1, options: ["play", "fight", "run"] },
        theme: "daily",
        difficulty: "beginner"
    },
    {
        sentence: "It is raining today.",
        translation: "יורד גשם היום.",
        words: ["It", "is", "raining", "today."],
        blank: { position: 2, options: ["raining", "snowing", "sunny"] },
        theme: "daily",
        difficulty: "beginner"
    },
    {
        sentence: "I sleep at night.",
        translation: "אני ישן בלילה.",
        words: ["I", "sleep", "at", "night."],
        blank: { position: 1, options: ["sleep", "play", "eat"] },
        theme: "daily",
        difficulty: "beginner"
    },
    {
        sentence: "My bed is soft.",
        translation: "המיטה שלי רכה.",
        words: ["My", "bed", "is", "soft."],
        blank: { position: 3, options: ["soft", "hard", "cold"] },
        theme: "daily",
        difficulty: "beginner"
    },
    {
        sentence: "I wake up early.",
        translation: "אני קם מוקדם.",
        words: ["I", "wake", "up", "early."],
        blank: { position: 3, options: ["early", "late", "never"] },
        theme: "daily",
        difficulty: "beginner"
    },
    {
        sentence: "We sing songs.",
        translation: "אנחנו שרים שירים.",
        words: ["We", "sing", "songs."],
        blank: { position: 1, options: ["sing", "eat", "throw"] },
        theme: "school",
        difficulty: "beginner"
    },

    // INTERMEDIATE SENTENCES - Complex Greetings & Conversations (6)
    {
        sentence: "How was your weekend?",
        translation: "איך היה סוף השבוע שלך?",
        words: ["How", "was", "your", "weekend?"],
        blank: { position: 3, options: ["weekend", "day", "morning"] },
        theme: "greetings",
        difficulty: "intermediate"
    },
    {
        sentence: "I had a great time at the party.",
        translation: "נהניתי מאוד במסיבה.",
        words: ["I", "had", "a", "great", "time", "at", "the", "party."],
        blank: { position: 3, options: ["great", "bad", "boring"] },
        theme: "greetings",
        difficulty: "intermediate"
    },
    {
        sentence: "Would you like some help?",
        translation: "האם תרצה קצת עזרה?",
        words: ["Would", "you", "like", "some", "help?"],
        blank: { position: 2, options: ["like", "hate", "need"] },
        theme: "greetings",
        difficulty: "intermediate"
    },
    {
        sentence: "I am looking forward to summer vacation.",
        translation: "אני מצפה לחופשת הקיץ.",
        words: ["I", "am", "looking", "forward", "to", "summer", "vacation."],
        blank: { position: 5, options: ["summer", "winter", "spring"] },
        theme: "greetings",
        difficulty: "intermediate"
    },
    {
        sentence: "Have you ever been to the zoo?",
        translation: "האם היית אי פעם בגן החיות?",
        words: ["Have", "you", "ever", "been", "to", "the", "zoo?"],
        blank: { position: 6, options: ["zoo", "moon", "space"] },
        theme: "greetings",
        difficulty: "intermediate"
    },
    {
        sentence: "That sounds like fun!",
        translation: "זה נשמע כיפי!",
        words: ["That", "sounds", "like", "fun!"],
        blank: { position: 3, options: ["fun", "boring", "scary"] },
        theme: "greetings",
        difficulty: "intermediate"
    },

    // INTERMEDIATE SENTENCES - Family & Relationships (6)
    {
        sentence: "My cousin lives in another city.",
        translation: "בן הדוד שלי גר בעיר אחרת.",
        words: ["My", "cousin", "lives", "in", "another", "city."],
        blank: { position: 1, options: ["cousin", "brother", "teacher"] },
        theme: "family",
        difficulty: "intermediate"
    },
    {
        sentence: "We visit grandpa every Sunday.",
        translation: "אנחנו מבקרים את סבא כל יום ראשון.",
        words: ["We", "visit", "grandpa", "every", "Sunday."],
        blank: { position: 1, options: ["visit", "call", "forget"] },
        theme: "family",
        difficulty: "intermediate"
    },
    {
        sentence: "My parents work hard for our family.",
        translation: "ההורים שלי עובדים קשה למען המשפחה.",
        words: ["My", "parents", "work", "hard", "for", "our", "family."],
        blank: { position: 2, options: ["work", "play", "sleep"] },
        theme: "family",
        difficulty: "intermediate"
    },
    {
        sentence: "I share my toys with my siblings.",
        translation: "אני משתף את האחים שלי בצעצועים.",
        words: ["I", "share", "my", "toys", "with", "my", "siblings."],
        blank: { position: 1, options: ["share", "hide", "break"] },
        theme: "family",
        difficulty: "intermediate"
    },
    {
        sentence: "Our family loves spending time together.",
        translation: "המשפחה שלנו אוהבת לבלות ביחד.",
        words: ["Our", "family", "loves", "spending", "time", "together."],
        blank: { position: 2, options: ["loves", "hates", "avoids"] },
        theme: "family",
        difficulty: "intermediate"
    },
    {
        sentence: "My nephew learned to walk yesterday.",
        translation: "האחיין שלי למד ללכת אתמול.",
        words: ["My", "nephew", "learned", "to", "walk", "yesterday."],
        blank: { position: 4, options: ["walk", "fly", "swim"] },
        theme: "family",
        difficulty: "intermediate"
    },

    // INTERMEDIATE SENTENCES - Animals & Nature (6)
    {
        sentence: "The butterfly landed on the flower.",
        translation: "הפרפר נחת על הפרח.",
        words: ["The", "butterfly", "landed", "on", "the", "flower."],
        blank: { position: 2, options: ["landed", "flew", "ate"] },
        theme: "animals",
        difficulty: "intermediate"
    },
    {
        sentence: "Dolphins are intelligent marine animals.",
        translation: "דולפינים הם יצורי ים חכמים.",
        words: ["Dolphins", "are", "intelligent", "marine", "animals."],
        blank: { position: 2, options: ["intelligent", "stupid", "lazy"] },
        theme: "animals",
        difficulty: "intermediate"
    },
    {
        sentence: "The owl hunts at night.",
        translation: "הינשוף צד בלילה.",
        words: ["The", "owl", "hunts", "at", "night."],
        blank: { position: 2, options: ["hunts", "sleeps", "plays"] },
        theme: "animals",
        difficulty: "intermediate"
    },
    {
        sentence: "Penguins cannot fly but they swim well.",
        translation: "פינגווינים לא יכולים לעוף אבל הם שוחים טוב.",
        words: ["Penguins", "cannot", "fly", "but", "they", "swim", "well."],
        blank: { position: 5, options: ["swim", "run", "jump"] },
        theme: "animals",
        difficulty: "intermediate"
    },
    {
        sentence: "The forest is home to many wild animals.",
        translation: "היער הוא בית לחיות בר רבות.",
        words: ["The", "forest", "is", "home", "to", "many", "wild", "animals."],
        blank: { position: 6, options: ["wild", "tame", "pet"] },
        theme: "animals",
        difficulty: "intermediate"
    },
    {
        sentence: "Bears hibernate during winter months.",
        translation: "דובים שוכבים בתרדמת חורף בחודשי החורף.",
        words: ["Bears", "hibernate", "during", "winter", "months."],
        blank: { position: 1, options: ["hibernate", "party", "travel"] },
        theme: "animals",
        difficulty: "intermediate"
    },

    // INTERMEDIATE SENTENCES - Food & Health (6)
    {
        sentence: "Eating vegetables helps you grow strong.",
        translation: "אכילת ירקות עוזרת לך לגדול חזק.",
        words: ["Eating", "vegetables", "helps", "you", "grow", "strong."],
        blank: { position: 1, options: ["vegetables", "candy", "chips"] },
        theme: "food",
        difficulty: "intermediate"
    },
    {
        sentence: "I prefer orange juice to apple juice.",
        translation: "אני מעדיף מיץ תפוזים על פני מיץ תפוחים.",
        words: ["I", "prefer", "orange", "juice", "to", "apple", "juice."],
        blank: { position: 1, options: ["prefer", "hate", "throw"] },
        theme: "food",
        difficulty: "intermediate"
    },
    {
        sentence: "Washing hands before meals is important.",
        translation: "חשוב לשטוף ידיים לפני הארוחות.",
        words: ["Washing", "hands", "before", "meals", "is", "important."],
        blank: { position: 0, options: ["Washing", "Drying", "Hiding"] },
        theme: "food",
        difficulty: "intermediate"
    },
    {
        sentence: "My favorite dish is spaghetti with tomato sauce.",
        translation: "המנה האהובה עלי היא ספגטי עם רוטב עגבניות.",
        words: ["My", "favorite", "dish", "is", "spaghetti", "with", "tomato", "sauce."],
        blank: { position: 4, options: ["spaghetti", "rice", "bread"] },
        theme: "food",
        difficulty: "intermediate"
    },
    {
        sentence: "We should drink plenty of water daily.",
        translation: "עלינו לשתות הרבה מים מדי יום.",
        words: ["We", "should", "drink", "plenty", "of", "water", "daily."],
        blank: { position: 5, options: ["water", "soda", "coffee"] },
        theme: "food",
        difficulty: "intermediate"
    },
    {
        sentence: "Too much sugar is bad for your teeth.",
        translation: "יותר מדי סוכר רע לשיניים.",
        words: ["Too", "much", "sugar", "is", "bad", "for", "your", "teeth."],
        blank: { position: 2, options: ["sugar", "water", "milk"] },
        theme: "food",
        difficulty: "intermediate"
    },

    // INTERMEDIATE SENTENCES - School & Learning (6)
    {
        sentence: "Science class is my favorite subject.",
        translation: "שיעור המדעים הוא המקצוע האהוב עלי.",
        words: ["Science", "class", "is", "my", "favorite", "subject."],
        blank: { position: 0, options: ["Science", "Math", "Art"] },
        theme: "school",
        difficulty: "intermediate"
    },
    {
        sentence: "I finished all my homework yesterday.",
        translation: "סיימתי את כל שיעורי הבית אתמול.",
        words: ["I", "finished", "all", "my", "homework", "yesterday."],
        blank: { position: 1, options: ["finished", "started", "forgot"] },
        theme: "school",
        difficulty: "intermediate"
    },
    {
        sentence: "Learning a new language takes practice.",
        translation: "לימוד שפה חדשה דורש תרגול.",
        words: ["Learning", "a", "new", "language", "takes", "practice."],
        blank: { position: 5, options: ["practice", "sleep", "magic"] },
        theme: "school",
        difficulty: "intermediate"
    },
    {
        sentence: "The library has thousands of books.",
        translation: "בספרייה יש אלפי ספרים.",
        words: ["The", "library", "has", "thousands", "of", "books."],
        blank: { position: 1, options: ["library", "kitchen", "bathroom"] },
        theme: "school",
        difficulty: "intermediate"
    },
    {
        sentence: "Our class is preparing for the school play.",
        translation: "הכיתה שלנו מתכוננת להצגה בבית הספר.",
        words: ["Our", "class", "is", "preparing", "for", "the", "school", "play."],
        blank: { position: 3, options: ["preparing", "sleeping", "running"] },
        theme: "school",
        difficulty: "intermediate"
    },
    {
        sentence: "I enjoy reading adventure stories before bed.",
        translation: "אני נהנה לקרוא סיפורי הרפתקאות לפני השינה.",
        words: ["I", "enjoy", "reading", "adventure", "stories", "before", "bed."],
        blank: { position: 2, options: ["reading", "burning", "throwing"] },
        theme: "school",
        difficulty: "intermediate"
    }
];

// Helper function to get sentences by difficulty
export function getSentencesByDifficulty(difficulty) {
    return sentences.filter(s => s.difficulty === difficulty);
}

// Helper function to get sentences by theme
export function getSentencesByTheme(theme) {
    return sentences.filter(s => s.theme === theme);
}

// Helper function to get random sentences
export function getRandomSentences(count, difficulty = null, theme = null) {
    let pool = sentences;

    if (difficulty) {
        pool = pool.filter(s => s.difficulty === difficulty);
    }

    if (theme) {
        const themes = Array.isArray(theme) ? theme : [theme];
        const filtered = pool.filter(s => themes.includes(s.theme));
        // Fall back to unthemed pool if no sentences match (e.g. no overlapping categories)
        if (filtered.length > 0) pool = filtered;
    }

    // Shuffle and take count
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

// Export summary for debugging
export const sentenceSummary = {
    total: sentences.length,
    beginner: sentences.filter(s => s.difficulty === 'beginner').length,
    intermediate: sentences.filter(s => s.difficulty === 'intermediate').length,
    themes: [...new Set(sentences.map(s => s.theme))],
};
