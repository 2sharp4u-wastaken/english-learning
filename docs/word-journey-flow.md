# Word Journey And Learning Flow

## Purpose

Word Journey is the vocabulary-growth path of the app. It is the main place where a player first learns words, strengthens weak words, and unlocks additional games through accumulated learned words.

## Agreed Journey Model

- A Word Journey always has 5 fixed stages:
  1. `discover`
  2. `listen-match`
  3. `spell-tiles`
  4. `say-word`
  5. `recall`
- The global `questionsPerGame` setting does not control Word Journey.
- `learningPace` controls only the number of words inside one journey:
  - `slow` = 3 words
  - `normal` = 5 words
  - `fast` = 8 words
- The in-game header should show both:
  - stage progress: `שלב X מתוך 5`
  - batch size: `N מילים במסע`
- The header chrome should stay visually secondary:
  - compact pills
  - small stage-map labels and icons
  - the learning card should remain the main focal point

## Current Journey Selection Logic

- Free-play Word Journey selects a batch from the active vocabulary categories.
- Selection is mastery-aware:
  - weak and unlearned words are preferred
  - words learned today are deprioritized so the next journey surfaces fresher material
- Topic-scoped Word Journey uses the topic word list, but still respects the same pace-based batch size.

## Completion And Progress

- Completing all 5 stages ends the journey and opens the Word Journey completion screen.
- Journey accuracy is calculated from the scored stages only:
  - `discover` is instructional and does not count toward accuracy
  - `listen-match`, `spell-tiles`, `say-word`, and `recall` are scored
- If final journey accuracy is at least `60%`, the batch is considered learned and the words are graduated into the learned-word bank.
- Learned words increase `learnedWords`, which is the main unlock currency for gated games.
- `totalPoints` are banked only when a game is completed, not during mid-run progress.
- Resetting or leaving a Word Journey mid-run should clear the run without banking new all-time points.

## Learning Flow

### Free-Play Flow

1. Player starts Word Journey.
2. The app serves a mastery-aware batch based on `learningPace`.
3. Player completes the 5-stage journey.
4. If accuracy is `>= 60%`, the words are graduated.
5. Graduated words contribute to new game unlocks.
6. The completion screen should encourage either:
   - another Word Journey for more words
   - the next newly unlocked game
7. If the next recommendation is also Word Journey, the screen should not show two separate buttons that both restart Word Journey.

### Topic-Scoped Flow

1. Player enters a course or topic.
2. The app can launch a Word Journey using topic words as preparation.
3. After completion, the primary next action should point back into the next topic activity, not generic free-play.

## Agreed Product Direction

- Keep Word Journey as a fixed 5-stage structure. Do not let generic question settings change its length.
- Treat `learningPace` as the only setting that changes Word Journey batch size.
- Keep free-play and topic-scoped journeys conceptually separate:
  - free-play = learn new or weak words
  - topic-scoped = prepare for the next topic activity
- Use the completion screen to guide the player forward:
  - free-play should bias toward more learning or newly unlocked practice
  - topic-scoped journeys should bias toward the next topic activity

## Follow-Up Improvements

- Graduation should eventually become per-word instead of whole-batch, so a weak word is not promoted by stronger words in the same run.
- Long words should not silently skip spelling. They need a lighter spelling interaction instead of being omitted from that stage.
- Recommendation logic should become more explicit about when the player is on a vocabulary-growth path versus a course/topic path.
