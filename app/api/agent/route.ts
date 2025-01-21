import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';
import type { Page } from 'puppeteer';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import type { ChatCompletionContentPart } from 'openai/resources/chat/completions';
import { config } from '../../config';
import { logger } from '../../utils/logger';

const openai = new OpenAI({
  apiKey: config.openai.apiKey || ''
});

interface Step {
  type: 'goto' | 'click' | 'complete';
  url?: string;
  elementText?: string;
  description: string;
  selector?: string;
}

async function getNextStep(goal: string, currentUrl: string | null, steps: Step[], screenshot?: string): Promise<Step> {
  logger.log('\n=== Getting Next Step ===');
  logger.log('Goal:', goal);
  logger.log('Current URL:', currentUrl);
  logger.log('Steps taken:', steps);

  const systemMessage = {
    role: 'system' as const,
    content: `You are an AI web navigation expert. Given a user's goal and the current webpage view, determine the next action to take.
    You must return a JSON object with one of these formats:
    
    For initial navigation:
    {
      "type": "goto",
      "url": "full URL to navigate to",
      "description": "why we're going to this URL"
    }
    
    For clicking elements:
    {
      "type": "click",
      "elementText": "exact text of element to click",
      "selector": "CSS selector to find the element (e.g., 'a[href='/explore']', 'button.explore-btn', etc.)",
      "description": "why we're clicking this element"
    }
    
    For completion:
    {
      "type": "complete",
      "description": "A detailed explanation of what we found and why the goal is complete. For example, if looking up trending cryptocurrencies, list the top trending ones with their key metrics. If checking a product's price, include the current price and any relevant details."
    }

    CRITICAL INSTRUCTIONS:
    1. ALWAYS use real, legitimate websites - never use example.com or placeholder URLs
    2. Choose well-known, reputable websites appropriate for the task
    3. Use the most direct and reliable path to achieve the goal
    4. When completing a mission, provide detailed information about what was found
    
    5. For ANY click action, you MUST:
       - See the EXACT text you want to click in the current view
       - The text must be on a clickable element (button, link, etc.)
       - Do not try to click text that's just part of content
       - Do not assume or guess text - it must be exact
    
    6. When analyzing the page:
       - Look at the actual UI elements present
       - Read the visible text carefully
       - Check navigation elements at the top/bottom of the page
       - Look for search inputs if you need to find something
    
    7. If you can't find what you need:
       - Say so in your description
       - Look for alternative navigation paths
       - Consider going back or trying a different approach
       - Don't try to click non-existent elements
    
    8. Common mistakes to avoid:
       - Don't use example.com or placeholder URLs
       - Don't assume standard UI patterns exist
       - Don't try to click static text or labels
       - Don't guess at element text - use exactly what you see
       - Don't try to combine or modify visible text
    
    Current goal: ${goal}
    Current URL: ${currentUrl}
    Steps taken: ${steps.map(s => s.description).join(', ')}`
  };

  const userMessage = {
    role: 'user' as const,
    content: screenshot ? [
      {
        type: 'text' as const,
        text: `Look at the current webpage view carefully. What elements do you see that are actually clickable? Based on these visible and clickable elements, what should be the next step to achieve: ${goal}`
      },
      {
        type: 'image_url' as const,
        image_url: {
          url: `data:image/jpeg;base64,${screenshot}`
        }
      }
    ] as ChatCompletionContentPart[] : `What should be the next step to achieve: ${goal}`
  };

  logger.log('\nSending request to OpenAI...');
  logger.log('System message:', systemMessage.content);

  const response = await openai.chat.completions.create({
    model: config.openai.model,
    messages: [systemMessage, userMessage],
    temperature: 0.1,
    response_format: { type: "json_object" }
  });

  logger.log('\nOpenAI Response:');
  logger.log('Raw response:', JSON.stringify(response, null, 2));
  
  const nextStep = JSON.parse(response.choices[0].message.content!);
  logger.log('Parsed next step:', nextStep);
  
  return nextStep;
}

async function waitForPageLoad(page: Page) {
  try {
    // First try networkidle2 which is more lenient
    await page.waitForNetworkIdle({ 
      idleTime: 500, 
      timeout: 10000 
    }).catch(e => logger.log('Network idle timeout:', e));
    
    // Wait for no loading indicators
    await page.evaluate(() => {
      return new Promise((resolve) => {
        // First check if page is already loaded
        if (document.readyState === 'complete') {
          resolve(true);
          return;
        }

        // If not, wait for load event
        window.addEventListener('load', () => resolve(true), { once: true });

        // Set a timeout just in case
        setTimeout(() => resolve(true), 10000);
      });
    });

    // Give a small buffer for any final renders
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
    logger.log('Error in waitForPageLoad:', error);
    // Don't throw, just continue
  }
}

async function takeScreenshot(page: Page): Promise<string> {
  // Only save screenshots to disk if enabled in config
  if (config.features.screenshots) {
    const screenshotsDir = path.join(process.cwd(), config.features.screenshotDir);
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  }

  // Wait for page to be fully loaded
  logger.log('Waiting for page to be fully loaded before taking screenshot...');
  await waitForPageLoad(page);

  // Take screenshot
  const screenshot = await page.screenshot({
    fullPage: true,
    type: 'jpeg',
    quality: 80
  });

  // Save to file if enabled
  if (config.features.screenshots) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(process.cwd(), config.features.screenshotDir, `screenshot-${timestamp}.jpg`);
    fs.writeFileSync(filename, screenshot);
  }

  // Always return base64 for API response
  return Buffer.from(screenshot).toString('base64');
}

async function executeStep(page: Page, step: Step): Promise<{ url: string; screenshot: string }> {
  logger.log('\n=== Executing Step ===');
  logger.log('Step:', step);

  let newUrl = page.url();

  if (step.type === 'goto' && step.url) {
    logger.log('Navigating to URL:', step.url);
    try {
      // Try with networkidle2 first (more lenient than networkidle0)
      await page.goto(step.url, { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });
    } catch (error) {
      logger.log('Initial navigation attempt failed:', error);
      
      // If that fails, try with just domcontentloaded
      logger.log('Retrying with domcontentloaded...');
      await page.goto(step.url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      // Then wait a bit for additional content to load
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    newUrl = page.url();
    logger.log('Navigation complete. New URL:', newUrl);
  }
  
  if (step.type === 'click' && step.elementText) {
    logger.log('Attempting to click element with text:', step.elementText);
    
    // Log all clickable elements first
    logger.log('\nScanning page for clickable elements...');
    const allElements = await page.evaluate(() => {
      const elements = [...document.querySelectorAll('a, button, [role="button"], div[onclick], span[onclick]')];
      return elements.map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim(),
        href: el instanceof HTMLAnchorElement ? el.href : null,
        role: el.getAttribute('role'),
        className: el.className,
        id: el.id,
        isVisible: el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().width > 0
      }));
    });
    logger.log('Found clickable elements:', allElements);

    // Try to find element using selector if provided
    if (step.selector) {
      logger.log('\nTrying to find element using selector:', step.selector);
      try {
        const element = await page.waitForSelector(step.selector, { 
          visible: true,
          timeout: 5000 
        });
        if (element) {
          logger.log('Found element using selector');
          await element.click();
          logger.log('Clicked element using selector');
        }
      } catch (error) {
        logger.log('Could not find element using selector:', error);
        // Fall back to text search
      }
    }

    // If selector didn't work or wasn't provided, try finding by text
    try {
      logger.log('\nTrying to find clickable element containing text:', step.elementText);
      
      const clickResult = await page.evaluate((text) => {
        // First try to find an exact match among clickable elements
        const clickableElements = [...document.querySelectorAll('a, button, [role="button"]')];
        let element = clickableElements.find(el => 
          el.textContent?.trim() === text && 
          window.getComputedStyle(el).display !== 'none'
        );

        // If no exact match, try partial match on clickable elements
        if (!element) {
          element = clickableElements.find(el => 
            el.textContent?.trim().includes(text) && 
            window.getComputedStyle(el).display !== 'none'
          );
        }

        if (element) {
          const rect = element.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;
          
          if (isVisible) {
            const elementInfo = {
              tag: element.tagName,
              text: element.textContent,
              href: element instanceof HTMLAnchorElement ? element.href : null,
              rect: {
                width: rect.width,
                height: rect.height,
                top: rect.top,
                left: rect.left
              }
            };
            (element as HTMLElement).click();
            return {
              clicked: true,
              element: elementInfo
            };
          }
        }
        return { clicked: false };
      }, step.elementText);

      if (clickResult.clicked) {
        logger.log('Successfully clicked element:', clickResult.element);
      } else {
        logger.log('No clickable element found');
      }

      if (!clickResult.clicked) {
        throw new Error(`Could not find clickable element with text: ${step.elementText}`);
      }
    } catch (error) {
      logger.error('Error clicking element:', error);
      throw error;
    }

    // Wait for any network requests to complete
    logger.log('\nWaiting for network requests to complete...');
    await page.waitForNetworkIdle({ timeout: 10000 }).catch(e => logger.log('Network idle timeout:', e));
    
    newUrl = page.url();
    logger.log('Current URL after click:', newUrl);
    
    // If URL hasn't changed, try to detect any single-page app navigation
    if (newUrl === page.url()) {
      logger.log('URL has not changed, checking for SPA navigation...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Give SPA more time to update
      const currentPath = await page.evaluate(() => window.location.pathname);
      logger.log('Current path:', currentPath);
    }
  }

  // Take screenshot after step execution and page is fully loaded
  logger.log('\nTaking screenshot...');
  const screenshot = await takeScreenshot(page);
  logger.log('Screenshot taken and encoded');

  return { url: newUrl, screenshot };
}

export async function POST(req: Request) {
  logger.log('=== API Request Received ===');
  let browser = null;
  let page = null;

  try {
    const { goal, currentUrl, steps } = await req.json();
    logger.log('Request payload:', { goal, currentUrl, steps });

    // Initialize Puppeteer with configuration
    logger.log('Initializing Puppeteer...');
    browser = await puppeteer.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        `--window-size=${config.browser.viewport.width},${config.browser.viewport.height}`
      ],
      defaultViewport: config.browser.viewport
    });
    page = await browser.newPage();
    
    // Set timeouts from config
    page.setDefaultTimeout(config.browser.timeouts.navigation);

    // Set common headers
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    // If we have a current URL, navigate to it first
    let screenshot = '';
    if (currentUrl) {
      logger.log('Navigating to current URL first:', currentUrl);
      try {
        await page.goto(currentUrl, { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });
      } catch (error) {
        logger.log('Initial navigation failed, retrying with domcontentloaded:', error);
        await page.goto(currentUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      screenshot = await takeScreenshot(page);
    }

    // Get next step from GPT-4o-mini
    logger.log('\nGetting next step from GPT-4...');
    const nextStep = await getNextStep(goal, currentUrl, steps, screenshot);
    logger.log('Received next step:', nextStep);

    // If the step is 'complete', return immediately
    if (nextStep.type === 'complete') {
      logger.log('Mission complete. Returning response.');
      return NextResponse.json({
        nextStep,
        currentUrl,
        isComplete: true,
        screenshot
      });
    }

    // Execute the step with Puppeteer
    logger.log('\nExecuting step...');
    const { url: newUrl, screenshot: newScreenshot } = await executeStep(page, nextStep);
    logger.log('Step execution complete');

    const response = {
      nextStep,
      currentUrl: newUrl,
      screenshot: newScreenshot,
      isComplete: false
    };
    logger.log('\nReturning response:', response);
    return NextResponse.json(response);

  } catch (error) {
    logger.error('\n=== Error in agent endpoint ===');
    logger.error('Error details:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  } finally {
    logger.log('\n=== Cleaning up ===');
    if (page) {
      logger.log('Closing page...');
      await page.close();
    }
    if (browser) {
      logger.log('Closing browser...');
      await browser.close();
    }
    logger.log('Cleanup complete');
  }
}