import { NextResponse } from 'next/server';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { AIProviderFactory } from '../../lib/ai/provider-factory';
import { playwrightService } from '../../lib/browser/playwright-service';
import { actionExecutor } from '../../lib/actions/executor';
import type { ChatMessage } from '../../lib/ai/types';
import type { Action, BrowserState } from '../../lib/actions/types';

// Initialize AI provider
const aiProvider = AIProviderFactory.createProvider(config.ai);

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

    // If we have a current URL but haven't navigated yet, go there first
    let browserState: BrowserState | undefined;
    if (currentUrl && actions.length === 0) {
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
    }

    // Get next action from AI
    const nextAction = await getNextAction(goal, currentUrl, actions, browserState);

    // If the action is 'complete', return immediately
    if (nextAction.type === 'complete') {
      logger.log('\n=== Mission Complete ===');
      await actionExecutor.cleanup();
      return NextResponse.json({
        nextAction,
        currentUrl,
        isComplete: true,
        screenshot: browserState?.screenshot || '',
        pageState: browserState ? {
          title: browserState.title,
          elements: browserState.elements,
          scrollPosition: browserState.scrollPosition
        } : undefined
      });
    }

    // Execute the action
    logger.log('\n=== Executing Action ===');
    const result = await actionExecutor.execute(nextAction);

    // Handle action failure
    if (!result.success) {
      logger.error('Action failed:', result.error);
      await actionExecutor.cleanup();
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    const response = {
      nextAction,
      currentUrl: result.currentUrl,
      screenshot: result.screenshot,
      pageState: result.pageState,
      isComplete: false
    };

    logger.log('\n=== Returning Response ===');
    logger.log('Response:', {
      actionType: response.nextAction.type,
      currentUrl: response.currentUrl,
      isComplete: response.isComplete
    });

    return NextResponse.json(response);

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