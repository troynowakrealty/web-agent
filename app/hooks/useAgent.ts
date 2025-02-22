import { useState, useCallback } from 'react';
import { Action } from '../lib/actions/types';

interface AgentState {
  goal: string | null;
  currentUrl: string | null;
  actions: Action[];
  isProcessing: boolean;
  error: string | null;
  isComplete: boolean;
  screenshot: string | null;
}

interface AgentResponse {
  nextAction: Action;
  currentUrl: string;
  error?: string;
  isComplete: boolean;
  screenshot: string;
}

export function useAgent() {
  console.log('Initializing useAgent hook');
  
  const [state, setState] = useState<AgentState>({
    goal: null,
    currentUrl: null,
    actions: [],
    isProcessing: false,
    error: null,
    isComplete: false,
    screenshot: null
  });

  const executeAction = async (goal: string, currentState: AgentState): Promise<AgentResponse> => {
    console.log('\n=== Executing Action ===');
    console.log('Current state:', {
      goal,
      currentUrl: currentState.currentUrl,
      actions: currentState.actions
    });

    const response = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal,
        currentUrl: currentState.currentUrl,
        actions: currentState.actions
      })
    });

    if (!response.ok) {
      console.error('API request failed:', response.status, response.statusText);
      throw new Error('Failed to execute action');
    }

    const data = await response.json();
    console.log('API Response:', data);
    return data;
  };

  const handleActionResponse = useCallback(async (response: AgentResponse, currentState: AgentState) => {
    console.log('\n=== Handling Action Response ===');
    console.log('Response:', response);
    console.log('Current state:', currentState);

    if (response.error) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: response.error || null
      }));
      return;
    }

    // Check if the action is complete
    if (response.isComplete || response.nextAction.type === 'complete') {
      console.log('Mission complete');
      setState(prev => ({
        ...prev,
        isProcessing: false,
        isComplete: true,
        currentUrl: response.currentUrl,
        screenshot: response.screenshot,
        actions: [...prev.actions, response.nextAction]
      }));
      return;
    }

    // Check for potential infinite loops
    // const newAction = response.nextAction;
    // const previousActions = currentState.actions;

    // If we have too many actions of the same type in sequence
    // const recentActions = previousActions.slice(-5);
    // const sameTypeCount = recentActions.filter(a => a.type === newAction.type).length;
    // if (sameTypeCount >= 4) {
    //   console.log('Detected potential infinite loop - too many actions of same type');
    //   setState(prev => ({
    //     ...prev,
    //     isProcessing: false,
    //     error: 'Detected potential infinite loop - too many repeated actions'
    //   }));
    //   return;
    // }

    // Update state with new action
    const newState: AgentState = {
      ...currentState,
      actions: [...currentState.actions, response.nextAction],
      currentUrl: response.currentUrl,
      screenshot: response.screenshot,
      error: null,
      isProcessing: true
    };

    // Update state first
    setState(newState);

    // Then schedule next action
    try {
      console.log('Executing next action...');
      const nextResponse = await executeAction(currentState.goal!, newState);
      await handleActionResponse(nextResponse, newState);
    } catch (error) {
      console.error('Error executing action:', error);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      }));
    }
  }, []);

  const startMission = useCallback(async (goal: string) => {
    console.log('\n=== Starting New Mission ===');
    console.log('Goal:', goal);

    // Create initial state
    const initialState: AgentState = {
      goal,
      currentUrl: null,
      actions: [],
      isProcessing: true,
      error: null,
      isComplete: false,
      screenshot: null
    };

    // Set initial state
    setState(initialState);

    try {
      console.log('Executing first action...');
      const response = await executeAction(goal, initialState);
      console.log('First action response:', response);
      await handleActionResponse(response, initialState);
    } catch (error) {
      console.error('Error starting mission:', error);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      }));
    }
  }, [handleActionResponse]);

  const reset = useCallback(() => {
    console.log('\n=== Resetting Agent State ===');
    setState({
      goal: null,
      currentUrl: null,
      actions: [],
      isProcessing: false,
      error: null,
      isComplete: false,
      screenshot: null
    });
  }, []);

  return {
    ...state,
    startMission,
    reset
  };
} 