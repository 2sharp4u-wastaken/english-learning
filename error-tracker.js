// Global Error Tracking System
// Captures all JavaScript errors and logs them in a structured format

class ErrorTracker {
    constructor() {
        this.errors = [];
        this.maxErrors = 50; // Keep last 50 errors
        this.init();
    }

    init() {
        // Capture uncaught errors
        window.addEventListener('error', (event) => {
            this.logError({
                type: 'JavaScript Error',
                message: event.message,
                file: event.filename,
                line: event.lineno,
                column: event.colno,
                stack: event.error?.stack,
                timestamp: new Date().toISOString()
            });
        });

        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.logError({
                type: 'Unhandled Promise Rejection',
                message: event.reason?.message || event.reason,
                stack: event.reason?.stack,
                timestamp: new Date().toISOString()
            });
        });

        // Capture console errors
        const originalError = console.error;
        console.error = (...args) => {
            this.logError({
                type: 'Console Error',
                message: args.map(arg =>
                    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
                ).join(' '),
                timestamp: new Date().toISOString()
            });
            originalError.apply(console, args);
        };

        console.log('%c🔍 Error Tracker Active', 'color: #4CAF50; font-weight: bold; font-size: 14px');
        console.log('%cAll errors will be logged and can be retrieved with: window.errorTracker.getReport()', 'color: #2196F3; font-size: 12px');
    }

    logError(errorData) {
        this.errors.push(errorData);

        // Keep only last maxErrors
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        // Send to server for terminal logging
        this.sendToServer(errorData);

        // Log to console with styling
        console.group(`%c❌ ${errorData.type}`, 'color: #f44336; font-weight: bold');
        console.log('%cMessage:', 'font-weight: bold', errorData.message);
        if (errorData.file) {
            console.log('%cFile:', 'font-weight: bold', `${errorData.file}:${errorData.line}:${errorData.column}`);
        }
        if (errorData.stack) {
            console.log('%cStack:', 'font-weight: bold');
            console.log(errorData.stack);
        }
        console.log('%cTime:', 'font-weight: bold', errorData.timestamp);
        console.groupEnd();
    }

    sendToServer(_errorData) {
        // No-op: errors are tracked in-memory only. The app is a static client
        // with no backend (Slice 4.3 retired server.py as a required dependency).
    }

    getReport() {
        if (this.errors.length === 0) {
            return '✅ No errors logged';
        }

        const report = [
            '═══════════════════════════════════════',
            '📊 ERROR REPORT',
            `Total Errors: ${this.errors.length}`,
            `Browser: ${navigator.userAgent}`,
            `Time: ${new Date().toISOString()}`,
            '═══════════════════════════════════════',
            ''
        ];

        this.errors.forEach((error, index) => {
            report.push(`\n[${index + 1}] ${error.type}`);
            report.push(`Time: ${error.timestamp}`);
            report.push(`Message: ${error.message}`);
            if (error.file) {
                report.push(`Location: ${error.file}:${error.line}:${error.column}`);
            }
            if (error.stack) {
                report.push('Stack Trace:');
                report.push(error.stack);
            }
            report.push('─────────────────────────────────────');
        });

        const reportText = report.join('\n');
        console.log(reportText);
        return reportText;
    }

    getErrorCount() {
        return this.errors.length;
    }

    clear() {
        this.errors = [];
        console.log('%c✨ Error log cleared', 'color: #4CAF50; font-weight: bold');
    }

    getLastError() {
        return this.errors[this.errors.length - 1];
    }

    // Get errors in JSON format for easy copying
    getJSON() {
        return JSON.stringify({
            browser: navigator.userAgent,
            errorCount: this.errors.length,
            errors: this.errors
        }, null, 2);
    }
}

// Initialize global error tracker
window.errorTracker = new ErrorTracker();

// Add helper commands to console
console.log('%c📋 Available Commands:', 'color: #FF9800; font-weight: bold; font-size: 13px');
console.log('%c  errorTracker.getReport()  %c- Get full error report', 'color: #2196F3', 'color: inherit');
console.log('%c  errorTracker.getJSON()    %c- Get errors as JSON', 'color: #2196F3', 'color: inherit');
console.log('%c  errorTracker.clear()      %c- Clear error log', 'color: #2196F3', 'color: inherit');
console.log('%c  errorTracker.getErrorCount() %c- Get error count', 'color: #2196F3', 'color: inherit');
