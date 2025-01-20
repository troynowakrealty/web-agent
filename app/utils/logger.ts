import fs from 'fs';
import path from 'path';
import { config } from '../config';

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
   * @param message - The message to log
   * @param data - Optional data to include in the log
   */
  log(message: string, data?: any) {
    // Always log to console in development
    console.log(message);
    if (data) console.log(data);

    // Only write to file if logging is enabled
    if (!this.enabled) return;

    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] ${message}`;
    
    if (data) {
      logMessage += '\n' + JSON.stringify(data, null, 2);
    }
    
    logMessage += '\n\n';
    fs.appendFileSync(this.logFile, logMessage);
  }

  /**
   * Log a section with a title and content.
   * @param title - The section title
   * @param content - The section content
   * @param skipConsole - Whether to skip console output
   */
  logSection(title: string, content: string, skipConsole: boolean = false) {
    if (!skipConsole) {
      console.log(`\n=== ${title} ===`);
      console.log(content);
      console.log('='.repeat(50));
    }

    if (!this.enabled) return;

    const separator = '='.repeat(50);
    const logMessage = `\n${separator}\n${title}\n${separator}\n${content}\n${separator}\n\n`;
    fs.appendFileSync(this.logFile, logMessage);
  }

  /**
   * Log content only to file, not to console.
   * @param title - The section title
   * @param content - The content to log
   */
  logToFileOnly(title: string, content: string) {
    if (!this.enabled) return;
    this.logSection(title, content, true);
  }

  /**
   * Log an error message with optional data
   * @param message - The error message to log
   * @param data - Optional error data to include
   */
  error(message: string, data?: any) {
    // Always log errors to console
    console.error(message);
    if (data) console.error(data);

    // Only write to file if logging is enabled
    if (!this.enabled) return;

    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] ERROR: ${message}`;
    
    if (data) {
      logMessage += '\n' + JSON.stringify(data, null, 2);
    }
    
    logMessage += '\n\n';
    fs.appendFileSync(this.logFile, logMessage);
  }

  /**
   * Check if logging is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Export a singleton instance
export const logger = new Logger(); 