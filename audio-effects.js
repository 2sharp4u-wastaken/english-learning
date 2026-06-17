// Audio Effects Manager for English Learning Games
// Uses Web Audio API for sound effects (no file dependencies)

/**
 * Selectable sound presets — used for the login/logout chimes and the home
 * score-pill sound packs (playerPrefs). Each id is a DISTINCT short sound
 * (pitch + waveform + shape); `notes` are [freq, dur] pairs. Kept in sync with
 * SOUND_IDS in src/bridge/playerPrefs.ts. (Was a 5-case switch where the prefs'
 * 'bell'/'chord' fell through to 'arpeggio' — that's why they sounded the same.)
 */
const AUDIO_SOUND_PRESETS = {
    arpeggio:  { notes: [[261.63,0.2],[329.63,0.2],[392.00,0.2],[523.25,0.5]], type: 'sine', gap: 0.05 },
    bell:      { bell: [261.63, 329.63, 392.00, 523.25] },
    chord:     { chord: [261.63, 329.63, 392.00, 523.25], type: 'sine', dur: 0.9 },
    fanfare:   { notes: [[392,0.12],[392,0.12],[392,0.12],[329.63,0.18],[392,0.45]], type: 'square', gap: 0.04 },
    twinkle:   { notes: [[523.25,0.15],[659.25,0.15],[783.99,0.15],[987.77,0.15],[1046.5,0.45]], type: 'triangle', gap: 0.04 },
    adventure: { notes: [[261.63,0.15],[392,0.15],[659.25,0.15],[783.99,0.15],[523.25,0.5]], type: 'square', gap: 0.04 },
    bloop:     { notes: [[196,0.12],[147,0.16]], type: 'sine', gap: 0.03 },
    rise:      { notes: [[262,0.07],[294,0.07],[330,0.07],[349,0.07],[392,0.07],[440,0.07],[494,0.07],[523,0.2]], type: 'sine', gap: 0 },
    descend:   { notes: [[659,0.12],[587,0.12],[523,0.12],[440,0.12],[392,0.3]], type: 'triangle', gap: 0.02 },
    marimba:   { notes: [[330,0.1],[392,0.1],[494,0.1],[392,0.1],[587,0.3]], type: 'triangle', gap: 0.03 },
    robot:     { notes: [[110,0.12],[138,0.12],[110,0.12],[165,0.22]], type: 'square', gap: 0.02 },
    magic:     { notes: [[784,0.1],[988,0.1],[1175,0.1],[988,0.1],[1319,0.3]], type: 'triangle', gap: 0.02 },
    bubble:    { notes: [[880,0.08],[1047,0.08],[1319,0.12]], type: 'sine', gap: 0.02 },
    eightbit:  { notes: [[523,0.1],[659,0.1],[523,0.1],[784,0.1],[659,0.28]], type: 'square', gap: 0.02 },
    harp:      { notes: [[262,0.18],[330,0.18],[392,0.18],[494,0.18],[523,0.18],[659,0.4]], type: 'sine', gap: 0.01 },
};

class AudioEffectsManager {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.volume = 0.3;
        this.initAudioContext();
    }

    initAudioContext() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        } catch (e) {
            console.warn('Web Audio API not supported', e);
            this.enabled = false;
        }
    }

    // Ensure audio context is running (browsers require user interaction first)
    async resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    // Play cheerful ascending arpeggio for correct answers
    async playCorrect() {
        if (!this.enabled) return;
        await this.resume();

        // Happy C major arpeggio: C5, E5, G5
        const notes = [523.25, 659.25, 783.99];
        const now = this.audioContext.currentTime;

        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.connect(gain);
            gain.connect(this.audioContext.destination);

            osc.frequency.value = freq;
            osc.type = 'sine';

            const startTime = now + i * 0.1;
            const duration = 0.3;

            gain.gain.setValueAtTime(this.volume, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

            osc.start(startTime);
            osc.stop(startTime + duration);
        });
    }

    // Play gentle descending tone for incorrect answers
    async playWrong() {
        if (!this.enabled) return;
        await this.resume();

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        const now = this.audioContext.currentTime;
        const duration = 0.2;

        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + duration);
        osc.type = 'sawtooth';

        gain.gain.setValueAtTime(this.volume * 0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.start(now);
        osc.stop(now + duration);
    }

    // Play rising melody for level ups and achievements
    async playLevelUp() {
        if (!this.enabled) return;
        await this.resume();

        // Rising C-D-E-G melody
        const melody = [
            { freq: 261.63, duration: 0.15 },  // C
            { freq: 293.66, duration: 0.15 },  // D
            { freq: 329.63, duration: 0.15 },  // E
            { freq: 392.00, duration: 0.3 }    // G
        ];

        let time = this.audioContext.currentTime;

        melody.forEach(note => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.connect(gain);
            gain.connect(this.audioContext.destination);

            osc.frequency.value = note.freq;
            osc.type = 'triangle';

            gain.gain.setValueAtTime(this.volume, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + note.duration);

            osc.start(time);
            osc.stop(time + note.duration);

            time += note.duration;
        });
    }

    // Play click sound for button interactions
    async playClick() {
        if (!this.enabled) return;
        await this.resume();

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        const now = this.audioContext.currentTime;
        const duration = 0.05;

        osc.frequency.value = 800;
        osc.type = 'sine';

        gain.gain.setValueAtTime(this.volume * 0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.start(now);
        osc.stop(now + duration);
    }

    // Play victory fanfare for game completion
    async playVictory() {
        if (!this.enabled) return;
        await this.resume();

        // Triumphant G major fanfare: G-B-D-G
        const melody = [
            { freq: 392.00, duration: 0.2 },   // G
            { freq: 493.88, duration: 0.2 },   // B
            { freq: 587.33, duration: 0.2 },   // D
            { freq: 783.99, duration: 0.4 }    // G (higher)
        ];

        let time = this.audioContext.currentTime;

        melody.forEach(note => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.connect(gain);
            gain.connect(this.audioContext.destination);

            osc.frequency.value = note.freq;
            osc.type = 'square';

            gain.gain.setValueAtTime(this.volume * 0.7, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + note.duration);

            osc.start(time);
            osc.stop(time + note.duration);

            time += note.duration * 0.8;  // Slight overlap for harmony
        });
    }

    // Play microphone activation sound
    async playMicOn() {
        if (!this.enabled) return;
        await this.resume();

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        const now = this.audioContext.currentTime;

        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        osc.type = 'sine';

        gain.gain.setValueAtTime(this.volume * 0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.start(now);
        osc.stop(now + 0.1);
    }

    // Play microphone deactivation sound
    async playMicOff() {
        if (!this.enabled) return;
        await this.resume();

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        const now = this.audioContext.currentTime;

        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
        osc.type = 'sine';

        gain.gain.setValueAtTime(this.volume * 0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.start(now);
        osc.stop(now + 0.1);
    }

    // ── Home stat-pill signatures (each chip gets its own character) ──────────

    // 🪙 Coins — classic arcade "coin" blip: a short grace note into a bright,
    // sustained ring (square wave, like a collectible pickup).
    async playCoin() {
        if (!this.enabled) return;
        await this.resume();
        const now = this.audioContext.currentTime;

        const blip = (freq, start, dur, vol) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            osc.type = 'square';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(vol, start);
            gain.gain.exponentialRampToValueAtTime(0.01, start + dur);
            osc.start(start);
            osc.stop(start + dur);
        };

        // B5 grace note → E6 ring (the Mario-coin interval).
        blip(987.77, now, 0.07, this.volume * 0.6);
        blip(1318.51, now + 0.07, 0.45, this.volume * 0.6);
    }

    // 🔥 Streak — a warm rising "power-up" whoosh: a pitch sweep with a sparkle
    // layer on top, conveying momentum/heat building.
    async playStreak() {
        if (!this.enabled) return;
        await this.resume();
        const now = this.audioContext.currentTime;
        const duration = 0.32;

        // Body: confident upward sweep with a tiny overshoot.
        const body = this.audioContext.createOscillator();
        const bodyGain = this.audioContext.createGain();
        body.connect(bodyGain);
        bodyGain.connect(this.audioContext.destination);
        body.type = 'sawtooth';
        body.frequency.setValueAtTime(220, now);
        body.frequency.exponentialRampToValueAtTime(880, now + duration * 0.8);
        body.frequency.exponentialRampToValueAtTime(740, now + duration);
        bodyGain.gain.setValueAtTime(this.volume * 0.35, now);
        bodyGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        body.start(now);
        body.stop(now + duration);

        // Sparkle layer an octave up for "heat".
        const top = this.audioContext.createOscillator();
        const topGain = this.audioContext.createGain();
        top.connect(topGain);
        topGain.connect(this.audioContext.destination);
        top.type = 'triangle';
        top.frequency.setValueAtTime(660, now);
        top.frequency.exponentialRampToValueAtTime(1760, now + duration);
        topGain.gain.setValueAtTime(this.volume * 0.18, now + 0.04);
        topGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        top.start(now + 0.04);
        top.stop(now + duration);
    }

    // ⭐ Words learned — a shimmering "magic sparkle": a fast descending chain of
    // high bell tones (fairy-dust), distinct from the ascending correct/level-up.
    async playSparkle() {
        if (!this.enabled) return;
        await this.resume();

        // Descending high bells: C7 · A6 · F6 · C6.
        const notes = [2093.0, 1760.0, 1396.91, 1046.5];
        let time = this.audioContext.currentTime;

        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            const dur = 0.22 - i * 0.02;
            gain.gain.setValueAtTime(this.volume * 0.4, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + dur);
            osc.start(time);
            osc.stop(time + dur);
            time += 0.06;
        });
    }

    // Helper: play a sequence of notes one after another
    _playMelody(notes, startTime, gap = 0) {
        let t = startTime;
        notes.forEach(note => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            osc.frequency.value = note.freq;
            osc.type = note.type || 'sine';
            gain.gain.setValueAtTime(this.volume * 0.5, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + note.dur);
            osc.start(t);
            osc.stop(t + note.dur);
            t += note.dur + gap;
        });
    }

    // Play a simultaneous chord (all notes at once).
    _playChord(freqs, type, dur, startTime) {
        freqs.forEach(freq => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            osc.frequency.value = freq;
            osc.type = type || 'sine';
            gain.gain.setValueAtTime(this.volume * 0.32, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
            osc.start(startTime);
            osc.stop(startTime + dur);
        });
    }

    // Gentle bell — notes struck in quick succession with a long tail.
    _playBell(freqs, startTime) {
        freqs.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            const t = startTime + i * 0.07;
            gain.gain.setValueAtTime(this.volume * 0.35, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
            osc.start(t);
            osc.stop(t + 1.4);
        });
    }

    // Play a named sound preset (AUDIO_SOUND_PRESETS). Used by the login/logout
    // chimes and the score-pill sound packs.
    async playSound(id) {
        if (!this.enabled) return;
        await this.resume();
        const preset = AUDIO_SOUND_PRESETS[id] || AUDIO_SOUND_PRESETS.arpeggio;
        const now = this.audioContext.currentTime;
        if (preset.bell) {
            this._playBell(preset.bell, now);
        } else if (preset.chord) {
            this._playChord(preset.chord, preset.type, preset.dur || 0.8, now);
        } else {
            this._playMelody(
                preset.notes.map(([freq, dur]) => ({ freq, dur, type: preset.type })),
                now,
                preset.gap == null ? 0.04 : preset.gap,
            );
        }
    }

    // Historical name kept for the login chime — both go through playSound.
    async playWelcomeChime(type = 'arpeggio') {
        return this.playSound(type);
    }

    // Set volume (0.0 to 1.0)
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }

    // Enable/disable sound effects
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    // Toggle sound effects
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

// Enhanced confetti celebrations
class ConfettiManager {
    // Standard celebration for correct answers
    static celebrateCorrect() {
        if (typeof confetti === 'undefined') return;

        confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.7 },
            colors: ['#667eea', '#764ba2', '#4facfe', '#00f2fe', '#ffd700']
        });
    }

    // Big celebration for perfect games
    static celebratePerfectGame() {
        if (typeof confetti === 'undefined') return;

        const duration = 3000;
        const end = Date.now() + duration;

        (function frame() {
            confetti({
                particleCount: 2,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#667eea', '#764ba2', '#ffd700']
            });
            confetti({
                particleCount: 2,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#4facfe', '#00f2fe', '#ffd700']
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
    }

    // Achievement unlock celebration
    static celebrateAchievement() {
        if (typeof confetti === 'undefined') return;

        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#667eea', '#764ba2', '#4facfe', '#00f2fe', '#ffd700']
        });
    }

    // Streak milestone celebration with fire colors
    static celebrateStreak() {
        if (typeof confetti === 'undefined') return;

        confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.6 },
            colors: ['#ff0000', '#ff6600', '#ffaa00', '#ffd700']
        });
    }

    // Word mastery celebration
    static celebrateMastery() {
        if (typeof confetti === 'undefined') return;

        confetti({
            particleCount: 80,
            spread: 80,
            origin: { y: 0.7 },
            colors: ['#10b981', '#34d399', '#6ee7b7', '#ffd700'],
            shapes: ['circle', 'square'],
            scalar: 1.2
        });
    }
}

// Initialize audio effects manager globally
window.audioEffects = new AudioEffectsManager();
window.confettiManager = ConfettiManager;
