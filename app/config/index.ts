/**
 * Configuration management for the GPT Brain application.
 * All environment variables and feature flags are centralized here.
 */

export const config = {
  /**
   * OpenAI Configuration
   */
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },

  /**
   * Development Features
   */
  features: {
    // Enable detailed logging in development
    logging: process.env.ENABLE_LOGGING === 'true',
    
    // Enable screenshot saving to disk
    screenshots: process.env.ENABLE_SCREENSHOTS === 'true',
    
    // Directory for saving screenshots (relative to project root)
    screenshotDir: process.env.SCREENSHOT_DIR || 'screenshots',
    
    // Directory for saving logs (relative to project root)
    logDir: process.env.LOG_DIR || 'logs',
  },

  /**
   * Browser Configuration
   */
  browser: {
    // Viewport settings
    viewport: {
      width: parseInt(process.env.BROWSER_WIDTH || '1280'),
      height: parseInt(process.env.BROWSER_HEIGHT || '800'),
    },
    
    // Navigation timeouts (in milliseconds)
    timeouts: {
      navigation: parseInt(process.env.NAVIGATION_TIMEOUT || '30000'),
      networkIdle: parseInt(process.env.NETWORK_IDLE_TIMEOUT || '10000'),
    },
  },
}; 