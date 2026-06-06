// Slice 5.3 — expression games (dedicated "ביטויים" surface).
// Seeds a kid user with ≥50 derived-learned words (so the expression gate opens)
// + the default kid-friendly register, then asserts the Home tier unlocks and each
// of the 4 games renders its interactive surface (not the locked screen) and takes
// an answer without crashing. All 4 are tap-based — no mic — so fully testable.
const { test, expect } = require('@playwright/test');

const USER_ID = 'expr_kid';
const PROGRESS_KEY = `v2_userProgress_${USER_ID}`;
const SETTINGS_KEY = 'v2_englishLearningSettings';
const UNLOCK_WORDS = 50;

// Build progress with ≥50 grandfathered learnedWords drawn from the real vocab
// bank (so getDerivedLearnedCount, which iterates window.vocabularyBank, counts
// them). Must run after the bank script has loaded.
async function seedUnlockedKid(page) {
  await page.goto('/');
  await page.waitForFunction(() => Array.isArray(window.vocabularyBank) && window.vocabularyBank.length >= 50);
  await page.evaluate(
    ({ userId, progressKey, settingsKey, need }) => {
      localStorage.setItem('users', JSON.stringify({
        [userId]: {
          id: userId, name: 'Kid', displayName: 'Kid', initial: 'K',
          role: 'student', password: null,
          created: new Date().toISOString(), lastLogin: null,
        },
      }));
      localStorage.setItem('currentUser', userId);
      localStorage.setItem('currentSession', JSON.stringify({
        userId, userName: 'Kid', displayName: 'Kid', initial: 'K',
        authenticated: true, loginTime: Date.now(), lastActivity: Date.now(),
      }));

      const learnedWords = {};
      for (const w of window.vocabularyBank.slice(0, need + 5)) {
        const key = `${String(w.word).toLowerCase()}_${w.category}`;
        learnedWords[key] = { graduatedDate: '2025-01-01', grandfathered: true };
      }
      localStorage.setItem(progressKey, JSON.stringify({ version: 4, learnedWords, wordMastery: {} }));

      localStorage.setItem(settingsKey, JSON.stringify({
        expressionsEnabled: true,
        expressionRegisters: { 'kid-friendly': true, casual: false, edgy: false },
      }));
    },
    { userId: USER_ID, progressKey: PROGRESS_KEY, settingsKey: SETTINGS_KEY, need: UNLOCK_WORDS },
  );
  // Reload so the engine boots from the seeded progress.
  await page.goto('/#/home');
  await page.waitForTimeout(1500);
}

const GAMES = [
  { id: 'expr-meaning', title: 'התאמת משמעות' },
  { id: 'expr-truefalse', title: 'נכון או לא?' },
  { id: 'expr-blank', title: 'השלימו את הביטוי' },
  { id: 'expr-build', title: 'בנו את הביטוי' },
];

test('home surfaces the ביטויים tier and unlocks it past 50 words', async ({ page }) => {
  await seedUnlockedKid(page);
  const tier = page.getByTestId('home-tier-expressions');
  await expect(tier).toBeVisible();
  // All four expression cards present and unlocked (not gated).
  for (const g of GAMES) {
    const card = tier.locator(`[data-testid="home-game-card"][data-game="${g.id}"]`);
    await expect(card).toHaveCount(1);
    await expect(card).toHaveAttribute('data-locked', 'false');
  }
});

test('a fresh kid sees the expression tier gated', async ({ page }) => {
  // No seeding → 0 learned words → tier locked.
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('users', JSON.stringify({
      fresh_kid: { id: 'fresh_kid', name: 'Fresh', displayName: 'Fresh', initial: 'F', role: 'student', password: null, created: new Date().toISOString(), lastLogin: null },
    }));
    localStorage.setItem('currentUser', 'fresh_kid');
    localStorage.setItem('currentSession', JSON.stringify({ userId: 'fresh_kid', userName: 'Fresh', displayName: 'Fresh', initial: 'F', authenticated: true, loginTime: Date.now(), lastActivity: Date.now() }));
  });
  await page.goto('/#/home');
  await page.waitForTimeout(1500);
  const card = page.locator('[data-testid="home-game-card"][data-game="expr-meaning"]');
  await expect(card).toHaveAttribute('data-locked', 'true');
});

for (const g of GAMES) {
  test(`${g.id} renders an interactive question (not locked)`, async ({ page }) => {
    await seedUnlockedKid(page);
    await page.goto(`/#/game/${g.id}`);
    await page.waitForTimeout(1200);

    // Not the locked / not-enough gate screen.
    await expect(page.getByText('הביטויים נפתחים אחרי')).toHaveCount(0);

    // The question surface renders (title text itself is nikud-injected, so we
    // assert the prompt card instead of matching the niqqud Hebrew title).
    await expect(page.getByTestId('media-prompt-card')).toBeVisible();

    if (g.id === 'expr-build') {
      // Word bank chips present; tap them all into place, then check.
      const bankChips = page.getByTestId('phrase-bank-chip');
      await expect(bankChips.first()).toBeVisible();
      let guard = 0;
      while ((await page.getByTestId('phrase-bank-chip').count()) > 0 && guard++ < 12) {
        await page.getByTestId('phrase-bank-chip').first().click();
      }
      const check = page.getByTestId('expr-build-check');
      await expect(check).toBeEnabled();
      await check.click();
    } else {
      // Multiple-choice surface: pick the first option.
      const options = page.getByTestId('answer-option');
      await expect(options.first()).toBeVisible();
      await options.first().click();
    }

    // A feedback banner appears (correct or incorrect) — proves the answer flow ran.
    await expect(page.getByTestId('feedback-banner')).toBeVisible({ timeout: 5000 });
  });
}
