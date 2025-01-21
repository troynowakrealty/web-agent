import { useState, useCallback } from 'react';

interface Step {
  type: 'goto' | 'click' | 'complete';
  url?: string;
  elementText?: string;
  description: string;
  selector?: string;
}

interface AgentState {
  goal: string | null;
  currentUrl: string | null;
  steps: Step[];
  isProcessing: boolean;
  error: string | null;
  isComplete: boolean;
  screenshot: string | null;
}

interface AgentResponse {
  nextStep: Step;
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
    steps: [],
    isProcessing: false,
    error: null,
    isComplete: false,
    screenshot: null
  });

  const executeStep = async (goal: string, currentState: AgentState): Promise<AgentResponse> => {
    console.log('\n=== Executing Step ===');
    console.log('Current state:', {
      goal,
      currentUrl: currentState.currentUrl,
      steps: currentState.steps
    });

    const response = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal,
        currentUrl: currentState.currentUrl,
        steps: currentState.steps
      })
    });

    if (!response.ok) {
      console.error('API request failed:', response.status, response.statusText);
      throw new Error('Failed to execute step');
    }

    const data = await response.json();
    console.log('API Response:', data);
    return data;
  };

  const handleStepResponse = useCallback(async (response: AgentResponse, currentState: AgentState) => {
    console.log('\n=== Handling Step Response ===');
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

    if (response.isComplete) {
      console.log('Mission complete');
      setState(prev => ({
        ...prev,
        isProcessing: false,
        isComplete: true,
        currentUrl: response.currentUrl,
        screenshot: response.screenshot,
        steps: [...prev.steps, response.nextStep]
      }));
      return;
    }

    // Update state with new step
    const newState: AgentState = {
      ...currentState,
      steps: [...currentState.steps, response.nextStep],
      currentUrl: response.currentUrl,
      screenshot: response.screenshot,
      error: null,
      isProcessing: true
    };

    // Update state first
    setState(newState);

    // Then schedule next step
    try {
      console.log('Executing next step...');
      const nextResponse = await executeStep(currentState.goal!, newState);
      await handleStepResponse(nextResponse, newState);
    } catch (error) {
      console.error('Error executing step:', error);
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
      steps: [],
      isProcessing: true,
      error: null,
      isComplete: false,
      screenshot: null
    };

    // Set initial state
    setState(initialState);

    try {
      console.log('Executing first step...');
      const response = await executeStep(goal, initialState);
      console.log('First step response:', response);
      await handleStepResponse(response, initialState);
    } catch (error) {
      console.error('Error starting mission:', error);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      }));
    }
  }, [handleStepResponse]);

  const reset = useCallback(() => {
    console.log('\n=== Resetting Agent State ===');
    setState({
      goal: null,
      currentUrl: null,
      steps: [],
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