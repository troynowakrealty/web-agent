import { Action } from '../actions/types';
import { logger } from '../../utils/logger';
import { AIProviderFactory } from './provider-factory';
import { config } from '../../config';
import { ChatMessage, ChatMessageRole } from './types';

interface AgentContext {
  currentUrl: string | null;
  actions: Action[];
  browserState?: {
    title: string;
    elements: string;
    scrollPosition: { x: number; y: number };
    screenshot?: string;
  };
}

export async function getNextAction(
  goal: string,
  context: AgentContext
): Promise<Action> {
  logger.log('info', { message: '=== Getting Next Action ===' });
  logger.log('info', {
    message: 'Current State',
    data: {
      goal,
      currentUrl: context.currentUrl,
      actionsCount: context.actions.length,
      lastAction: context.actions[context.actions.length - 1]?.description || 'No previous actions'
    }
  });

  const systemMessage: ChatMessage = {
    role: 'system' as ChatMessageRole,
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

    CRITICAL INSTRUCTIONS FOR TASK COMPLETION:
    1. For flight searches:
       - Mark as complete when flight options are clearly displayed
       - Include available flight details in the completion summary
       - Don't continue clicking if valid flight results are shown
      
    2. General completion criteria:
       - If the current view shows the information needed to satisfy the goal
       - If further actions would not provide additional relevant information
       - When the core objective has been achieved
       - When search results or options are clearly displayed

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
    Current URL: ${context.currentUrl}
    Actions taken: ${context.actions.map(a => a.description).join(', ')}

    ${context.browserState ? `
    Current page state:
    Title: ${context.browserState.title}
    
    Available Elements:
    ${context.browserState.elements}
    
    Current scroll position: x=${context.browserState.scrollPosition.x}, y=${context.browserState.scrollPosition.y}
    ` : ''}
    `
  };

  const userMessage: ChatMessage = {
    role: 'user' as ChatMessageRole,
    content: `Look at the current webpage view and available elements carefully. What should be the next action to achieve: ${goal}`
  };

  logger.log('info', { message: '=== Requesting AI Decision ===' });
  logger.log('info', { message: 'System prompt length', data: systemMessage.content.length });
  logger.log('info', { message: 'Has browser state', data: !!context.browserState });

  const aiProvider = AIProviderFactory.createProvider(config.ai);
  const response = context.browserState?.screenshot 
    ? await aiProvider.chatWithVision([systemMessage, userMessage], context.browserState.screenshot)
    : await aiProvider.chat([systemMessage, userMessage]);

  logger.log('info', { message: '=== Processing AI Response ===' });
  
  try {
    const nextAction = JSON.parse(response);
    logger.log('info', { message: 'Next action', data: nextAction });
    return nextAction;
  } catch (error) {
    logger.error({ 
      message: 'Failed to parse AI response',
      data: { error: error instanceof Error ? error.message : 'Unknown error', response }
    });
    throw new Error('Failed to parse AI response as JSON');
  }
} 