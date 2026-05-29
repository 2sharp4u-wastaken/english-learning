// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Slice 3.7.1 verification: Word Builder retired, folded into Fill Blanks.
 *
 * Covers:
 *  1. Orphan localStorage sweep on app boot (savedGame_<uid>_word-builder,
 *     v2_wordbuilder_audio_<uid>) — see app.js setupWithAuth().
 *  2. Bookmark redirect /#/game/word-builder → /#/game/fill-blanks
 *     (RETIRED_GAMES in src/features/games/GameHostPage.tsx).
 *  3. word-builder is absent from the home game list.
 *  4. Stats page renders without console errors mentioning word-builder.
 */

const TEST_USER_ID = 'slice371test';

async function setupAuthedUser(page) {
    await page.goto('/');
    await page.evaluate((userId) => {
        const users = { [userId]: { id: userId, name: 'Slice 3.7.1', pin: '1234', avatar: 'S' } };
        localStorage.setItem('authUsers', JSON.stringify(users));
        localStorage.setItem('currentUser', userId);
        localStorage.setItem('currentSession', JSON.stringify({
            userId, authenticated: true, loginTime: Date.now(), lastActivity: Date.now(),
        }));
        localStorage.removeItem(`v2_userProgress_${userId}`);
    }, TEST_USER_ID);
    await page.reload();
    await page.waitForTimeout(1500);
}

test.describe('Slice 3.7.1 — Word Builder retirement', () => {
    test('orphan word-builder localStorage keys are cleared on boot', async ({ page }) => {
        await setupAuthedUser(page);

        // Seed the orphan keys that pre-3.7.1 Word Builder would have written.
        await page.evaluate((userId) => {
            localStorage.setItem(`savedGame_${userId}_word-builder`, JSON.stringify({ index: 3, score: 45 }));
            localStorage.setItem(`v2_wordbuilder_audio_${userId}`, JSON.stringify({ playsLeft: 5 }));
            // Re-establish session since reload happens next.
            localStorage.setItem('currentSession', JSON.stringify({
                userId, authenticated: true, loginTime: Date.now(), lastActivity: Date.now(),
            }));
        }, TEST_USER_ID);

        // Confirm seeds landed.
        const beforeSaved = await page.evaluate((uid) => localStorage.getItem(`savedGame_${uid}_word-builder`), TEST_USER_ID);
        const beforeAudio = await page.evaluate((uid) => localStorage.getItem(`v2_wordbuilder_audio_${uid}`), TEST_USER_ID);
        expect(beforeSaved).not.toBeNull();
        expect(beforeAudio).not.toBeNull();

        // Reload — app.js setupWithAuth() should sweep them.
        await page.reload();
        await page.waitForTimeout(1500);

        const afterSaved = await page.evaluate((uid) => localStorage.getItem(`savedGame_${uid}_word-builder`), TEST_USER_ID);
        const afterAudio = await page.evaluate((uid) => localStorage.getItem(`v2_wordbuilder_audio_${uid}`), TEST_USER_ID);
        expect(afterSaved).toBeNull();
        expect(afterAudio).toBeNull();
    });

    test('bookmarked /#/game/word-builder redirects to fill-blanks', async ({ page }) => {
        await setupAuthedUser(page);

        await page.goto('/#/game/word-builder');
        await page.waitForTimeout(1000);

        // Hash should be rewritten by <Navigate replace />.
        await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/game/fill-blanks');
    });

    test('word-builder card is not present on home', async ({ page }) => {
        await setupAuthedUser(page);
        // Legacy `.game-card` welcome markup was retired in Slice 4.1; assert against
        // the React home card so this stays meaningful (not vacuously true).
        await page.evaluate(() => { window.location.hash = '#/home'; });
        await page.waitForTimeout(800);
        await expect(page.locator('[data-testid="home-game-card"]').first()).toBeVisible();
        const card = page.locator('[data-testid="home-game-card"][data-game="word-builder"]');
        await expect(card).toHaveCount(0);
    });

    test('stats page has no console errors referencing word-builder', async ({ page }) => {
        await setupAuthedUser(page);

        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') errors.push(msg.text());
        });
        page.on('pageerror', err => errors.push(err.message));

        await page.goto('/stats.html');
        await page.waitForTimeout(1500);

        const wordBuilderErrors = errors.filter(e => e.toLowerCase().includes('word-builder') || e.toLowerCase().includes('wordbuilder'));
        expect(wordBuilderErrors, `Found word-builder errors: ${wordBuilderErrors.join(' | ')}`).toEqual([]);
    });
});
