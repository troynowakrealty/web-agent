import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import { execSync } from 'child_process';

export class PlaywrightService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private pages: Page[] = [];

  async initialize() {
    if (this.browser) {
      return;
    }

    try {
      logger.log('info', { message: 'Initializing Playwright browser' });
      this.browser = await chromium.launch({
        headless: false
      });

      // Create a browser context
      this.context = await this.browser.newContext();

      // Listen for new pages/tabs
      this.context.on('page', async (page) => {
        logger.log('info', { message: 'New page created' });
        this.pages.push(page);
        
        // Wait for the new page to be ready
        await page.waitForLoadState('domcontentloaded');
        
        // Switch to the new page
        this.page = page;
        
        // Set up page close handler
        page.on('close', () => {
          logger.log('info', { message: 'Page closed' });
          this.pages = this.pages.filter(p => p !== page);
          if (this.page === page) {
            // If the closed page was current, switch back to the last available page
            this.page = this.pages[this.pages.length - 1] || null;
          }
        });
      });

      this.page = await this.context.newPage();
      this.pages.push(this.page);
      await this.page.setViewportSize(config.browser.viewport);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Executable doesn't exist")) {
        logger.log('info', { message: 'Chromium not found, attempting to install...' });
        try {
          execSync('npx playwright install chromium', { stdio: 'inherit' });
          // Retry browser launch after installation
          this.browser = await chromium.launch({
            headless: false
          });
          this.context = await this.browser.newContext();
          this.page = await this.context.newPage();
          this.pages.push(this.page);
          await this.page.setViewportSize(config.browser.viewport);
        } catch (installError) {
          logger.error({
            message: 'Failed to install Chromium',
            data: { error: installError instanceof Error ? installError.message : 'Unknown error' }
          });
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

  async getAllPages(): Promise<Page[]> {
    return this.pages;
  }

  async switchToPage(predicate: (page: Page) => Promise<boolean>): Promise<boolean> {
    logger.log('info', { message: 'Attempting to switch to matching page' });
    for (const page of this.pages) {
      if (await predicate(page)) {
        this.page = page;
        logger.log('info', { message: 'Switched to matching page' });
        return true;
      }
    }
    return false;
  }

  async cleanup() {
    // Close all pages except the main one
    for (const page of this.pages) {
      if (page !== this.page) {
        await page.close().catch(e => logger.error({
          message: 'Error closing page',
          data: { error: e instanceof Error ? e.message : 'Unknown error' }
        }));
      }
    }
    this.pages = this.page ? [this.page] : [];

    if (this.page) {
      await this.page.close().catch(e => logger.error({
        message: 'Error closing page',
        data: { error: e instanceof Error ? e.message : 'Unknown error' }
      }));
      this.page = null;
    }

    if (this.context) {
      await this.context.close().catch(e => logger.error({
        message: 'Error closing context',
        data: { error: e instanceof Error ? e.message : 'Unknown error' }
      }));
      this.context = null;
    }

    if (this.browser) {
      await this.browser.close().catch(e => logger.error({
        message: 'Error closing browser',
        data: { error: e instanceof Error ? e.message : 'Unknown error' }
      }));
      this.browser = null;
    }
  }

  async goto(url: string) {
    if (!this.page) throw new Error('Browser not initialized');
    
    logger.log('info', { message: 'Navigating to', data: { url } });
    try {
      await this.page.goto(url, {
        waitUntil: 'networkidle',
        timeout: config.browser.timeouts.navigation
      });
    } catch (error) {
      logger.error({
        message: 'Navigation failed, retrying with domcontentloaded',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
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

    logger.log('info', { message: 'Clicking element by selector', data: { selector } });
    try {
      // Wait longer for dynamic content
      const element = await this.page.waitForSelector(selector, { 
        state: 'visible', 
        timeout: 10000  // Increased timeout
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

      // Wait for element to be stable (no movement)
      await this.page.waitForTimeout(500);

      // Store the current number of pages before clicking
      const pageCountBefore = this.pages.length;

      // Try direct click first
      try {
        await element.click({
          timeout: 10000,  // Increased timeout
          force: false,
          delay: 100  // Add slight delay
        });

        // Wait a bit to see if a new page opens
        await this.page.waitForTimeout(1000);

        // Check if a new page was opened
        if (this.pages.length > pageCountBefore) {
          logger.log('info', { message: 'New page opened after click' });
          // The page event handler will automatically switch to the new page
          // Wait for the new page to be ready
          await this.page?.waitForLoadState('domcontentloaded');
        }
      } catch (error) {
        logger.log('info', { 
          message: 'Direct click failed, trying alternative methods',
          data: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
        
        // Wait a bit before trying alternative
        await this.page.waitForTimeout(500);
        
        // Try clicking with JavaScript
        await this.page.evaluate((sel: string) => {
          const element = document.querySelector(sel);
          if (element) {
            // Dispatch mousedown and mouseup events before click
            element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            (element as HTMLElement).click();
          }
        }, selector);
        
        // Wait longer to see if the click had an effect
        await this.page.waitForTimeout(2000);

        // Check again for new pages
        if (this.pages.length > pageCountBefore) {
          logger.log('info', { message: 'New page opened after alternative click' });
          await this.page?.waitForLoadState('domcontentloaded');
        }
      }
      
      logger.log('info', { message: 'Successfully clicked element' });
    } catch (error) {
      logger.error({
        message: 'Click by selector failed',
        data: { error: error instanceof Error ? error.message : 'Unknown error', selector }
      });
      throw new Error(`Failed to click element with selector: ${selector}`);
    }
  }

  async typeBySelector(selector: string, text: string) {
    if (!this.page) throw new Error('Browser not initialized');

    logger.log('info', { message: 'Typing text by selector', data: { selector, text } });
    try {
      const element = await this.page.waitForSelector(selector, { 
        state: 'visible', 
        timeout: 10000  // Increased timeout
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

      // Try focusing the element first
      await element.focus();
      await this.page.waitForTimeout(200);  // Increased wait after focus

      // Try direct type first
      try {
        await element.fill('');  // Clear existing text
        await element.type(text, { delay: 100 });  // Increased typing delay
        
        // Wait for potential autocomplete/dropdown to appear
        await this.page.waitForTimeout(1000);
        
        // Press Enter to trigger search
        await element.press('Enter');
        
        // Wait for results to load
        await this.page.waitForTimeout(2000);
      } catch (error) {
        logger.log('info', { 
          message: 'Direct type failed, trying alternative methods',
          data: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
        
        // Try typing with JavaScript
        await this.page.evaluate(({ sel, text }) => {
          const element = document.querySelector(sel) as HTMLInputElement;
          if (element) {
            element.value = text;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
            element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
          }
        }, { sel: selector, text });

        // Wait for results to load
        await this.page.waitForTimeout(2000);
      }
      
      logger.log('info', { message: 'Successfully typed text' });
    } catch (error) {
      logger.error({
        message: 'Type by selector failed',
        data: { error: error instanceof Error ? error.message : 'Unknown error', selector }
      });
      throw new Error(`Failed to type text into element with selector: ${selector}`);
    }
  }

  async getCurrentUrl(): Promise<string> {
    if (!this.page) throw new Error('Browser not initialized');
    return this.page.url();
  }

  async takeScreenshot(): Promise<string> {
    if (!this.page) throw new Error('Browser not initialized');

    logger.log('info', { message: 'Taking screenshot' });
    try {
      const screenshot = await this.page.screenshot({
        type: 'jpeg',
        quality: 80,
        fullPage: true
      });

      return screenshot.toString('base64');
    } catch (error) {
      logger.error({
        message: 'Screenshot failed',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
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
      logger.log('info', { 
        message: 'Network idle timeout reached, continuing anyway',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
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
      logger.error({
        message: 'Accessibility evaluation failed',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      return [];
    }
  }
}

// Export singleton instance
export const playwrightService = new PlaywrightService(); 