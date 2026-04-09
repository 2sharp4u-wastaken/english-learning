# English Learning Games — לומדים אנגלית בכיף

An interactive English learning web app for Hebrew-speaking kids (ages 5–8). Features multiple game types, gamification, progress tracking, and parent controls — all in a fun, RTL Hebrew interface.

## Getting Started

```bash
python3 server.py
```

Then open `http://localhost:8000` in your browser.

> The server sends no-cache headers to avoid ES module caching issues during development.

## Features

- **Multiple game types** covering vocabulary, grammar, pronunciation, listening, reading, and more
- **Gamification** — coins, streaks, certificates, and course progression
- **Progress tracking** — per-user word mastery, daily streaks, statistics
- **Parent controls** — password-protected settings, custom word lists
- **Hebrew UI** — fully RTL, designed for young learners
- **Text-to-speech** — built-in pronunciation for all words and sentences

## Game Types

| Game | Hebrew Name | Description |
|------|------------|-------------|
| Vocabulary | בונה אוצר מילים | Learn new words with images |
| Grammar | תרגול דקדוק | Grammar practice (articles, tenses) |
| Grammar Beginner | דקדוק למתחילים | Simplified grammar for younger kids |
| Pronunciation | אימון הגייה | Speech recognition practice |
| Listening | הבנת הנשמע | Hear and identify words |
| Reading | קריאה | Reading comprehension |
| Practice | תרגול | Mixed review |
| ABC | א-ב-ג | Letter recognition |
| Memory | זיכרון | Card matching game |
| Sentence Scramble | סדר המשפט | Arrange words into sentences |
| Fill in the Blanks | השלם את החסר | Cloze sentences |
| Picture Match | התאם תמונה | Match pictures to words |
| Word Journey | מסע המילים | Multi-stage scaffolded vocab learning |

## Word Categories

Animals, Colors, Food, Home, Body, Clothes, Actions, Adjectives, Numbers, Feelings, Nature, Sports, School, Places, Time, Transportation, Music, Tools, Signs, Family, Weather, Gaming (Minecraft, Roblox), and Custom words.

## Project Structure

```
index.html          # Main game shell
settings.html       # Parent-protected settings
stats.html          # Statistics view
words.html          # Word browser

app.js              # App bootstrap & auth
gameLogic.js        # Core GameManager
gamification.js     # Coins, streaks, badges

games/              # One file per game type
managers/           # ScoreManager, ProgressManager, GameRegistry,
                    # CourseManager, CertificateManager, CoinManager
data/
  categories/       # Word lists by category
  courses/          # Structured course definitions
  sentences.js      # Sentence data for sentence games
  vocabularyBank.js # Full word list for settings/stats
components/         # UI components (header, score display)
utils/              # Image renderer, word image manager
```

## Architecture Notes

- **No build system** — plain ES6 modules loaded directly in the browser
- **No backend** — all state stored in `localStorage`
- **Cache busting** — CSS/JS files use `?t=<timestamp>` query strings

### Word Schema

```js
{ word, translation, category, image, imageUrl? }
```

### Key localStorage Keys

| Key | Purpose |
|-----|---------|
| `currentUser` | Active user ID |
| `userProgress_<userId>` | Progress, word mastery, streak, certificates |
| `englishLearningSettings` | App-wide settings |
| `authUsers` | User accounts |
| `customWords_global` | Parent-added custom words (shared across users) |

## Adding Custom Words

In the parent settings (password-protected), you can add custom words with a Hebrew translation and optional image. Custom words are shared across all user profiles.
