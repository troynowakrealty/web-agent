import { chromium, Browser, Page } from 'playwright';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import { execSync } from 'child_process';

export class PlaywrightService {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize() {
    if (this.browser) {
      return;
    }

    try {
      logger.log('Initializing Playwright browser');
      this.browser = await chromium.launch({
        headless: false
      });

      this.page = await this.browser.newPage();
      await this.page.setViewportSize(config.browser.viewport);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Executable doesn't exist")) {
        logger.log('Chromium not found, attempting to install...');
        try {
          execSync('npx playwright install chromium', { stdio: 'inherit' });
          // Retry browser launch after installation
          this.browser = await chromium.launch({
            headless: false
          });
          this.page = await this.browser.newPage();
          await this.page.setViewportSize(config.browser.viewport);
        } catch (installError) {
          logger.error('Failed to install Chromium:', installError);
          throw new Error('Failed to initialize browser. Please run: npx playwright install chromium');
        }
      } else {
        throw error;
      }
    }
  }

  async getPage(): Promise<Page | null> {
    return this.page;
  }

  async cleanup() {
    if (this.page) {
      await this.page.close().catch(e => logger.error('Error closing page:', e));
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close().catch(e => logger.error('Error closing browser:', e));
      this.browser = null;
    }
  }

  async goto(url: string) {
    if (!this.page) throw new Error('Browser not initialized');
    
    logger.log('Navigating to:', url);
    try {
      await this.page.goto(url, {
        waitUntil: 'networkidle',
        timeout: config.browser.timeouts.navigation
      });
    } catch (error) {
      logger.error('Navigation failed, retrying with domcontentloaded:', error);
      // Retry with less strict wait condition
      await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: config.browser.timeouts.navigation
      });
      // Wait a bit for any additional content to load
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  async clickBySelector(selector: string) {
    if (!this.page) throw new Error('Browser not initialized');

    logger.log('Clicking element by selector:', selector);
    try {
      const element = await this.page.waitForSelector(selector, { 
        state: 'visible', 
        timeout: 5000 
      });
      
      if (!element) {
        throw new Error('Element not found after waiting');
      }

      // Check if element is actually visible and clickable
      const isVisible = await element.isVisible();
      if (!isVisible) {
        throw new Error('Element is not visible');
      }

      // Get element position
      const box = await element.boundingBox();
      if (!box) {
        throw new Error('Element has no bounding box');
      }

      // Click the element
      await element.click({
        timeout: 5000,
        force: false // Don't force click if element is not actionable
      });
      
      logger.log('Successfully clicked element');
    } catch (error) {
      logger.error('Click by selector failed:', error);
      throw new Error(`Failed to click element with selector: ${selector}`);
    }
  }

  async typeBySelector(selector: string, text: string) {
    if (!this.page) throw new Error('Browser not initialized');

    logger.log('Typing text by selector:', { selector, text });
    try {
      const element = await this.page.waitForSelector(selector, { 
        state: 'visible', 
        timeout: 5000 
      });
      
      if (!element) {
        throw new Error('Element not found after waiting');
      }

      // Check if element is actually visible and editable
      const isVisible = await element.isVisible();
      const isEditable = await element.isEditable();
      
      if (!isVisible) {
        throw new Error('Element is not visible');
      }
      
      if (!isEditable) {
        throw new Error('Element is not editable');
      }

      // Clear existing content first
      await element.fill('');
      
      // Type the text
      await element.type(text, { delay: 50 }); // Add small delay between keystrokes
      
      logger.log('Successfully typed text');
    } catch (error) {
      logger.error('Type by selector failed:', error);
      throw new Error(`Failed to type text into element with selector: ${selector}`);
    }
  }

  async getCurrentUrl(): Promise<string> {
    if (!this.page) throw new Error('Browser not initialized');
    return this.page.url();
  }

  async takeScreenshot(): Promise<string> {
    if (!this.page) throw new Error('Browser not initialized');

    logger.log('Taking screenshot');
    try {
      const screenshot = await this.page.screenshot({
        type: 'jpeg',
        quality: 80,
        fullPage: true
      });

      return screenshot.toString('base64');
    } catch (error) {
      logger.error('Screenshot failed:', error);
      throw new Error('Failed to take screenshot');
    }
  }

  async waitForLoadState() {
    if (!this.page) throw new Error('Browser not initialized');

    try {
      await this.page.waitForLoadState('networkidle', {
        timeout: config.browser.timeouts.networkIdle
      });
    } catch (error) {
      logger.log('Network idle timeout reached, continuing anyway');
    }

    // Additional wait for any dynamic content
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  async evaluateAccessibility() {
    if (!this.page) throw new Error('Browser not initialized');

    try {
      // Get all clickable elements with their properties
      const elements = await this.page.evaluate(() => {
        const clickable = document.querySelectorAll('a, button, [role="button"], input[type="submit"]');
        return Array.from(clickable).map(el => ({
          tag: el.tagName,
          text: el.textContent?.trim(),
          isVisible: !!(el.getBoundingClientRect().width && el.getBoundingClientRect().height),
          href: el instanceof HTMLAnchorElement ? el.href : null,
          role: el.getAttribute('role'),
        }));
      });

      return elements;
    } catch (error) {
      logger.error('Accessibility evaluation failed:', error);
      return [];
    }
  }
}

// Export singleton instance
export const playwrightService = new PlaywrightService(); 