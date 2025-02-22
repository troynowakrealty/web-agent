import fs from 'fs';
import path from 'path';
import { config } from '../config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogData {
  message: string;
  data?: unknown;
}

/**
 * Logger class for handling application logging with configurable output.
 * Logs can be written to both file and console based on environment settings.
 */
class Logger {
  private logFile: string;
  private sessionId: string;
  private enabled: boolean;

  constructor() {
    this.enabled = config.features.logging;
    this.sessionId = new Date().toISOString().replace(/[:.]/g, '-');

    // Only create log directory and file if logging is enabled
    if (this.enabled) {
      const logsDir = path.join(process.cwd(), config.features.logDir);
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      this.logFile = path.join(logsDir, `agent-${this.sessionId}.log`);
      fs.writeFileSync(this.logFile, `=== Session Started: ${this.sessionId} ===\n\n`);
    } else {
      this.logFile = '';
    }
  }

  /**
   * Log a message with optional data. Will write to file if enabled.
   */
  log(level: LogLevel, data: LogData | string): void {
    const logData: LogData = typeof data === 'string' ? { message: data } : data;

    // Always log to console in development
    console.log(logData.message);
    if (logData.data) console.log(logData.data);

    // Only write to file if logging is enabled
    if (!this.enabled) return;

    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] ${level.toUpperCase()}: ${this.formatData(logData)}`;
    
    if (logData.data) {
      logMessage += '\n' + JSON.stringify(logData.data, null, 2);
    }
    
    logMessage += '\n\n';
    fs.appendFileSync(this.logFile, logMessage);
  }

  /**
   * Log a section with a title and content.
   */
  logSection(title: string, content: string) {
    this.log('info', { message: title, data: content });
    
    if (!this.enabled) return;

    const separator = '='.repeat(50);
    const logMessage = `\n${separator}\n${title}\n${separator}\n${content}\n${separator}\n\n`;
    fs.appendFileSync(this.logFile, logMessage);
  }

  /**
   * Log content only to file, not to console.
   */
  logToFileOnly(title: string, content: string) {
    if (!this.enabled) return;
    this.log('info', { message: title, data: content });
  }

  /**
   * Log an error message with optional data
   */
  error(data: LogData | string): void {
    const logData: LogData = typeof data === 'string' ? { message: data } : data;
    this.log('error', logData);
  }

  /**
   * Check if logging is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  private formatData(data: LogData): string {
    return data.message;
  }
}

// Export a singleton instance
export const logger = new Logger(); 