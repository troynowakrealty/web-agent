import { NextResponse } from 'next/server';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { AIProviderFactory } from '../../lib/ai/provider-factory';
import { playwrightService } from '../../lib/browser/playwright-service';
import { actionExecutor } from '../../lib/actions/executor';
import { DOMService } from '../../lib/browser/dom-service';
import { getNextAction } from '../../lib/ai/agent';
import type { ChatMessage } from '../../lib/ai/types';
import type { Action, BrowserState } from '../../lib/actions/types';

// Initialize AI provider
const aiProvider = AIProviderFactory.createProvider(config.ai);

// Initialize services
let domService: DOMService;

async function getNextAction(
  goal: string,
  currentUrl: string | null,
  actions: Action[],
  browserState?: BrowserState
): Promise<Action> {
  logger.log('\n=== Getting Next Action ===');
  logger.log('Current State:', {
    goal,
    currentUrl,
    actionsCount: actions.length,
    lastAction: actions[actions.length - 1]?.description || 'No previous actions'
  });

  const systemMessage: ChatMessage = {
    role: 'system',
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
      "index": 123,
      "description": "why we're clicking this element"
    }
    
    For typing:
    {
      "type": "type",
      "index": 123,
      "text": "text to type",
      "description": "why we're typing this text"
    }
    
    For scrolling:
    {
      "type": "scroll",
      "index": 123,
      "description": "why we're scrolling to this element"
    }
    
    For completion:
    {
      "type": "complete",
      "description": "why we're done",
      "summary": "detailed summary of what was found",
      "evaluation": "success" | "failed" | "partial"
    }

    CRITICAL INSTRUCTIONS FOR ELEMENT INTERACTION:
    1. Elements are indexed starting from 1 and are shown with [index] in the page state
    2. Each element entry shows:
       - Index number in brackets [1]
       - Full HTML tag with attributes
       - Element content/text
       - Visual highlight color on the page
    
    3. Before interacting with any element:
       - Verify the element exists in the current page state
       - Check if the element is visible (shown in page state)
       - Ensure the element is interactive (links, buttons, inputs, etc.)
       - Use the exact index number shown in brackets
    
    4. For clicking:
       - Only click elements that are actually clickable
       - Verify the element's purpose matches your intent
       - If element is not in view, use scroll action first
    
    5. For typing:
       - Only type in input fields, textareas, or contenteditable elements
       - Verify the input field is visible and enabled
       - Keep input text relevant and concise
    
    6. For scrolling:
       - Use when elements are out of the viewport
       - Scroll to elements before interacting with them
       - Check element visibility after scrolling

    7. Page State Understanding:
       - Review the full element list before deciding actions
       - Consider element hierarchy and relationships
       - Pay attention to element attributes and roles
       - Use element text content to confirm correct targets

    CRITICAL RULES:
    1. ALWAYS use real, legitimate websites - never use example.com or placeholder URLs
    2. Choose well-known, reputable websites appropriate for the task
    3. Use the most direct and reliable path to achieve the goal
    4. ANALYZE THE CURRENT VIEW FIRST - if you see enough information to satisfy the goal, complete the mission
    5. Only navigate further if the current view doesn't contain enough information
    
    Current goal: ${goal}
    Current URL: ${currentUrl}
    Actions taken: ${actions.map(a => a.description).join(', ')}

    ${browserState ? `
    Current page state:
    Title: ${browserState.title}
    
    Available Elements:
    ${browserState.elements}
    
    Current scroll position: x=${browserState.scrollPosition.x}, y=${browserState.scrollPosition.y}
    ` : ''}
    `
  };

  const userMessage: ChatMessage = {
    role: 'user',
    content: `Look at the current webpage view and available elements carefully. What should be the next action to achieve: ${goal}`
  };

  logger.log('\n=== Requesting AI Decision ===');
  logger.log('System prompt length:', systemMessage.content.length);
  logger.log('Has browser state:', !!browserState);

  const response = browserState?.screenshot 
    ? await aiProvider.chatWithVision([systemMessage, userMessage], browserState.screenshot)
    : await aiProvider.chat([systemMessage, userMessage]);

  logger.log('\n=== Processing AI Response ===');
  
  try {
    const nextAction = JSON.parse(response);
    logger.log('Next action:', nextAction);
    return nextAction;
  } catch (error) {
    logger.error('Failed to parse AI response:', error);
    logger.error('Raw response:', response);
    throw new Error('Failed to parse AI response as JSON');
  }
}

export async function POST(req: Request) {
  logger.log('\n=== New Agent Request ===');

  try {
    const { goal, currentUrl, actions = [] } = await req.json();
    logger.log('Request payload:', { goal, currentUrl, actionsCount: actions.length });

    // Initialize browser if needed
    await playwrightService.initialize();
    const page = await playwrightService.getPage();
    if (!page) {
      throw new Error('Failed to initialize browser page');
    }

    // Initialize DOM service if needed
    if (!domService) {
      domService = new DOMService(page);
    }

    // Get or create browser state
    let browserState: BrowserState | undefined;
    
    if (currentUrl) {
      if (actions.length === 0) {
        // Initial navigation to current URL
        logger.log('Performing initial navigation to:', currentUrl);
        const result = await actionExecutor.execute({
          type: 'goto',
          url: currentUrl,
          description: 'Returning to current page'
        });

        if (result.pageState) {
          browserState = {
            url: result.currentUrl,
            title: result.pageState.title,
            elements: result.pageState.elements,
            scrollPosition: result.pageState.scrollPosition,
            screenshot: result.screenshot
          };
        }
      } else {
        // Get current state for subsequent actions
        logger.log('Getting current browser state');
        const result = await actionExecutor.execute({
          type: 'scroll',
          index: 1,
          description: 'Refreshing page state'
        });

        if (result.pageState) {
          browserState = {
            url: result.currentUrl,
            title: result.pageState.title,
            elements: result.pageState.elements,
            scrollPosition: result.pageState.scrollPosition,
            screenshot: result.screenshot
          };
        }
      }
    }

    if (!browserState) {
      logger.log('Warning: No browser state available');
    } else {
      logger.log('Browser state captured:', {
        url: browserState.url,
        title: browserState.title,
        elementCount: browserState.elements.split('\n').length
      });
    }

    // Get the next action from the AI
    const nextAction = await getNextAction(goal, currentUrl, actions, browserState);

    logger.log('\n=== Processing AI Response ===');
    logger.log('Next action:', nextAction);

    // Execute the action
    try {
      if (nextAction.type === 'goto') {
        await playwrightService.goto(nextAction.url);
      } else if (nextAction.type === 'click') {
        await domService.validateElement(nextAction.index);
        await playwrightService.clickBySelector(`[data-element-index="${nextAction.index}"]`);
      } else if (nextAction.type === 'type') {
        await domService.validateElement(nextAction.index);
        await playwrightService.typeBySelector(`[data-element-index="${nextAction.index}"]`, nextAction.text);
      } else if (nextAction.type === 'scroll') {
        await domService.scrollToElement(nextAction.index);
      }

      // Wait for any dynamic content to load
      await playwrightService.waitForLoadState();

      // Take a screenshot after the action
      const screenshot = await playwrightService.takeScreenshot();

      // Get the updated page state
      const newState = await domService.getPageState(true);
      const formattedElements = await domService.getFormattedElements();

      logger.log('\n=== Returning Response ===');
      return NextResponse.json({
        actionType: nextAction.type,
        currentUrl: await playwrightService.getCurrentUrl(),
        isComplete: nextAction.type === 'complete',
        nextAction,
        screenshot,
        pageState: newState,
        formattedElements
      });
    } catch (error) {
      logger.error('Action execution failed:', error);
      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        currentUrl: await playwrightService.getCurrentUrl()
      });
    }

  } catch (error) {
    logger.error('\n=== Error in Agent Endpoint ===');
    logger.error('Error details:', error);
    await actionExecutor.cleanup();
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
}