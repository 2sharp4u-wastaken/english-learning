// Console Logger - Captures all browser console output to downloadable file
// Intercepts console.log, console.warn, console.error, console.info, console.debug

class ConsoleLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 5000; // Limit to prevent memory issues
        this.startTime = new Date();
        this.originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info,
            debug: console.debug
        };

        this.initializeInterceptors();
        this.addDownloadButton();

        console.log('🔍 Console logger initialized - all logs will be captured');
    }

    getTimestamp() {
        const now = new Date();
        const elapsed = now - this.startTime;
        const seconds = (elapsed / 1000).toFixed(3);
        return `[${now.toISOString()}] [+${seconds}s]`;
    }

    formatArgs(args) {
        return Array.from(args).map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
    }

    captureLog(level, args) {
        const timestamp = this.getTimestamp();
        const message = this.formatArgs(args);
        const entry = `${timestamp} [${level.toUpperCase()}] ${message}`;

        this.logs.push(entry);

        // Limit log size
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
    }

    initializeInterceptors() {
        // Intercept console.log
        console.log = (...args) => {
            this.captureLog('log', args);
            this.originalConsole.log.apply(console, args);
        };

        // Intercept console.warn
        console.warn = (...args) => {
            this.captureLog('warn', args);
            this.originalConsole.warn.apply(console, args);
        };

        // Intercept console.error
        console.error = (...args) => {
            this.captureLog('error', args);
            this.originalConsole.error.apply(console, args);
        };

        // Intercept console.info
        console.info = (...args) => {
            this.captureLog('info', args);
            this.originalConsole.info.apply(console, args);
        };

        // Intercept console.debug
        console.debug = (...args) => {
            this.captureLog('debug', args);
            this.originalConsole.debug.apply(console, args);
        };

        // Capture uncaught errors
        window.addEventListener('error', (event) => {
            this.captureLog('ERROR', [`Uncaught Error: ${event.message}`, `at ${event.filename}:${event.lineno}:${event.colno}`, event.error?.stack || '']);
        });

        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.captureLog('ERROR', [`Unhandled Promise Rejection: ${event.reason}`, event.reason?.stack || '']);
        });
    }

    addDownloadButton() {
        // Create a floating download button
        const button = document.createElement('button');
        button.id = 'console-logger-download-btn';
        button.innerHTML = '📋 Download Logs';
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10000;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            transition: all 0.3s ease;
            font-family: Arial, sans-serif;
        `;

        button.onmouseover = () => {
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
        };

        button.onmouseout = () => {
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
        };

        button.onclick = () => this.downloadLogs();

        document.body.appendChild(button);
    }

    downloadLogs() {
        // Generate log file content
        const header = `Console Logs - English Learning Games
Generated: ${new Date().toISOString()}
Session Start: ${this.startTime.toISOString()}
User Agent: ${navigator.userAgent}
Total Logs: ${this.logs.length}
${'-'.repeat(80)}

`;

        const content = header + this.logs.join('\n');

        // Create blob and download
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `console-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`✅ Downloaded ${this.logs.length} log entries`);
    }

    // Manual methods to access logs
    getLogs() {
        return this.logs;
    }

    clearLogs() {
        this.logs = [];
        console.log('🗑️ Logs cleared');
    }

    getLogCount() {
        return this.logs.length;
    }
}

// Initialize logger immediately
const consoleLogger = new ConsoleLogger();

// Make it globally accessible
window.consoleLogger = consoleLogger;

// Export for module use
export default consoleLogger;
