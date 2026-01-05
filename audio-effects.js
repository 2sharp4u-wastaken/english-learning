// Audio Effects Manager for English Learning Games
// Uses Web Audio API for sound effects (no file dependencies)

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
