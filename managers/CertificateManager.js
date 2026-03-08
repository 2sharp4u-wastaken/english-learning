/**
 * CertificateManager.js
 * Manages certificate generation, display, and downloads
 */

export class CertificateManager {
    constructor(userProgress) {
        this.userProgress = userProgress;
        this.initialized = false;
    }

    /**
     * Initialize certificate system
     */
    initialize() {
        if (this.initialized) return;

        if (!this.userProgress.certificates) {
            this.userProgress.certificates = [];
        }

        this.initialized = true;
    }

    /**
     * Award a certificate
     * @param {Object} certificateData
     * @param {string} certificateData.id - Certificate ID
     * @param {string} certificateData.topicId - Topic ID
     * @param {string} certificateData.topicName - Topic display name
     * @param {number} certificateData.score - Final score
     * @returns {Object} The created certificate
     */
    awardCertificate(certificateData) {
        const { id, topicId, topicName, score } = certificateData;

        // Check if certificate already exists
        const existing = this.getCertificate(id);
        if (existing) {
            console.log('[CertificateManager] Certificate already awarded:', id);
            return existing;
        }

        const certificate = {
            id,
            topicId,
            topicName,
            earnedDate: new Date().toISOString().split('T')[0],
            score: Math.round(score),
            timestamp: Date.now()
        };

        this.userProgress.certificates.push(certificate);
        this.saveProgress();

        console.log('[CertificateManager] Certificate awarded:', certificate);
        return certificate;
    }

    /**
     * Get certificate by ID
     * @param {string} certificateId
     * @returns {Object|null}
     */
    getCertificate(certificateId) {
        return this.userProgress.certificates.find(cert => cert.id === certificateId) || null;
    }

    /**
     * Get certificate by topic ID
     * @param {string} topicId
     * @returns {Object|null}
     */
    getCertificateByTopic(topicId) {
        return this.userProgress.certificates.find(cert => cert.topicId === topicId) || null;
    }

    /**
     * Get all certificates
     * @returns {Array<Object>}
     */
    getAllCertificates() {
        return [...this.userProgress.certificates].sort((a, b) =>
            b.timestamp - a.timestamp // Most recent first
        );
    }

    /**
     * Check if user has certificate
     * @param {string} certificateId
     * @returns {boolean}
     */
    hasCertificate(certificateId) {
        return this.userProgress.certificates.some(cert => cert.id === certificateId);
    }

    /**
     * Show certificate modal
     * @param {string} certificateId
     * @param {string} studentName
     */
    showCertificateModal(certificateId, studentName = 'Student') {
        const certificate = this.getCertificate(certificateId);
        if (!certificate) {
            console.error('[CertificateManager] Certificate not found:', certificateId);
            return;
        }

        const modal = document.getElementById('certificate-modal');
        if (!modal) {
            console.error('[CertificateManager] Certificate modal not found in DOM');
            return;
        }

        // Populate certificate data
        const studentNameEl = document.getElementById('cert-student-name');
        const topicNameEl = document.getElementById('cert-topic-name');
        const dateEl = document.getElementById('cert-date');
        const scoreEl = document.getElementById('cert-score');

        if (studentNameEl) studentNameEl.textContent = studentName;
        if (topicNameEl) topicNameEl.textContent = certificate.topicName;
        if (dateEl) dateEl.textContent = this.formatDate(certificate.earnedDate);
        if (scoreEl) scoreEl.textContent = `Score: ${certificate.score}%`;

        // Show modal with animation
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);

        // Play celebration sound/animation
        this.playCelebration();
    }

    /**
     * Hide certificate modal
     */
    hideCertificateModal() {
        const modal = document.getElementById('certificate-modal');
        if (!modal) return;

        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }

    /**
     * Download certificate as image
     * @param {string} certificateId
     * @param {string} studentName
     */
    async downloadCertificate(certificateId, studentName = 'Student') {
        const certificate = this.getCertificate(certificateId);
        if (!certificate) {
            console.error('[CertificateManager] Certificate not found:', certificateId);
            return;
        }

        try {
            // Create canvas for certificate
            const canvas = document.createElement('canvas');
            canvas.width = 1200;
            canvas.height = 900;
            const ctx = canvas.getContext('2d');

            // Draw certificate background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Border
            ctx.strokeStyle = '#4CAF50';
            ctx.lineWidth = 20;
            ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

            // Inner border
            ctx.strokeStyle = '#81C784';
            ctx.lineWidth = 5;
            ctx.strokeRect(60, 60, canvas.width - 120, canvas.height - 120);

            // Title
            ctx.fillStyle = '#2E7D32';
            ctx.font = 'bold 72px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('🏆 Certificate of Achievement 🏆', canvas.width / 2, 150);

            // "This certifies that"
            ctx.fillStyle = '#333333';
            ctx.font = '32px Arial';
            ctx.fillText('This certifies that', canvas.width / 2, 250);

            // Student name
            ctx.fillStyle = '#1976D2';
            ctx.font = 'bold 64px Arial';
            ctx.fillText(studentName, canvas.width / 2, 350);

            // "has successfully completed"
            ctx.fillStyle = '#333333';
            ctx.font = '32px Arial';
            ctx.fillText('has successfully completed', canvas.width / 2, 430);

            // Topic name
            ctx.fillStyle = '#2E7D32';
            ctx.font = 'bold 48px Arial';
            ctx.fillText(certificate.topicName, canvas.width / 2, 530);

            // Score
            ctx.fillStyle = '#FF6F00';
            ctx.font = 'bold 40px Arial';
            ctx.fillText(`Score: ${certificate.score}%`, canvas.width / 2, 630);

            // Date
            ctx.fillStyle = '#666666';
            ctx.font = '28px Arial';
            ctx.fillText(this.formatDate(certificate.earnedDate), canvas.width / 2, 750);

            // Signature line
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(400, 800);
            ctx.lineTo(800, 800);
            ctx.stroke();

            ctx.fillStyle = '#666666';
            ctx.font = '24px Arial';
            ctx.fillText('English Adventures Academy', canvas.width / 2, 840);

            // Convert canvas to blob and download
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `certificate-${certificate.topicId}-${certificate.earnedDate}.png`;
                link.click();
                URL.revokeObjectURL(url);

                console.log('[CertificateManager] Certificate downloaded');
            });

        } catch (error) {
            console.error('[CertificateManager] Error downloading certificate:', error);
        }
    }

    /**
     * Generate certificate gallery HTML
     * @returns {string} HTML string
     */
    generateGalleryHTML() {
        const certificates = this.getAllCertificates();

        if (certificates.length === 0) {
            return `
                <div class="no-certificates">
                    <p>אין עדיין תעודות</p>
                    <p>השלם נושאים כדי לקבל תעודות!</p>
                </div>
            `;
        }

        return certificates.map(cert => `
            <div class="certificate-card" data-cert-id="${cert.id}">
                <div class="cert-card-badge">🏆</div>
                <h4>${cert.topicName}</h4>
                <div class="cert-card-score">${cert.score}%</div>
                <div class="cert-card-date">${this.formatDate(cert.earnedDate)}</div>
                <button class="cert-view-btn" onclick="window.certificateManager?.showCertificateModal('${cert.id}', '${this.getStudentName()}')">
                    View
                </button>
            </div>
        `).join('');
    }

    /**
     * Play celebration animation/sound
     */
    playCelebration() {
        // Create confetti effect
        this.createConfetti();

        // Play success sound if available
        const audio = new Audio();
        audio.volume = 0.3;

        // Try to play celebration sound
        const celebrationNotes = [523.25, 587.33, 659.25, 783.99]; // C, D, E, G
        this.playMelody(celebrationNotes);
    }

    /**
     * Create confetti animation
     */
    createConfetti() {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
        const confettiCount = 50;

        for (let i = 0; i < confettiCount; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = Math.random() * 100 + '%';
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.animationDelay = Math.random() * 3 + 's';
                document.body.appendChild(confetti);

                setTimeout(() => confetti.remove(), 3000);
            }, i * 30);
        }
    }

    /**
     * Play melody using Web Audio API
     * @param {Array<number>} notes - Array of frequencies
     */
    playMelody(notes) {
        if (!window.AudioContext && !window.webkitAudioContext) return;

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const duration = 0.2;

        notes.forEach((frequency, index) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + index * duration);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + (index + 1) * duration);

            oscillator.start(audioContext.currentTime + index * duration);
            oscillator.stop(audioContext.currentTime + (index + 1) * duration);
        });
    }

    /**
     * Format date for display
     * @param {string} dateString - ISO date string
     * @returns {string}
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }

    /**
     * Get student name from settings or default
     * @returns {string}
     */
    getStudentName() {
        return this.userProgress.studentName || 'Student';
    }

    /**
     * Save progress
     */
    saveProgress() {
        try {
            if (window.app?.saveUserProgress) {
                window.app.saveUserProgress();
            } else {
                const userId = localStorage.getItem('currentUser') || 'O';
                localStorage.setItem(`userProgress_${userId}`, JSON.stringify(this.userProgress));
            }
        } catch (error) {
            console.error('[CertificateManager] Error saving progress:', error);
        }
    }

    /**
     * Get statistics
     * @returns {Object}
     */
    getStats() {
        return {
            totalCertificates: this.userProgress.certificates.length,
            averageScore: this.getAverageScore(),
            mostRecentCertificate: this.getMostRecentCertificate()
        };
    }

    /**
     * Get average certificate score
     * @returns {number}
     */
    getAverageScore() {
        if (this.userProgress.certificates.length === 0) return 0;

        const total = this.userProgress.certificates.reduce((sum, cert) => sum + cert.score, 0);
        return Math.round(total / this.userProgress.certificates.length);
    }

    /**
     * Get most recent certificate
     * @returns {Object|null}
     */
    getMostRecentCertificate() {
        const certs = this.getAllCertificates();
        return certs.length > 0 ? certs[0] : null;
    }
}
