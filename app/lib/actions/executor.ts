import { Action, ActionResult } from './types';
import { playwrightService } from '../browser/playwright-service';
import { logger } from '../../utils/logger';

export class ActionExecutor {
  async execute(action: Action): Promise<ActionResult> {
    try {
      logger.log('Executing action:', action);

      switch (action.type) {
        case 'goto':
          await playwrightService.goto(action.url);
          break;

        case 'click':
          if (action.text) {
            await playwrightService.click(action.selector || '*', { text: action.text });
          } else if (action.selector) {
            await playwrightService.click(action.selector);
          } else {
            throw new Error('Click action requires either text or selector');
          }
          break;

        case 'type':
          await playwrightService.type(action.selector, action.text);
          break;

        case 'complete':
          // No action needed for completion
          break;
      }

      // Wait for any navigation or dynamic content to load
      await playwrightService.waitForLoadState();

      // Get current state
      const currentUrl = await playwrightService.getCurrentUrl();
      const screenshot = await playwrightService.takeScreenshot();

      return {
        success: true,
        currentUrl,
        screenshot
      };

    } catch (error) {
      logger.error('Action execution failed:', error);
      
      // Try to get current state even if action failed
      let currentUrl = '';
      let screenshot = '';
      try {
        currentUrl = await playwrightService.getCurrentUrl();
        screenshot = await playwrightService.takeScreenshot();
      } catch (e) {
        logger.error('Failed to get state after error:', e);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        currentUrl,
        screenshot
      };
    }
  }
}

// Export singleton instance
export const actionExecutor = new ActionExecutor(); 