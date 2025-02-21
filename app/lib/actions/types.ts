export type ActionType = 'goto' | 'click' | 'type' | 'complete' | 'scroll';

export interface BaseAction {
  type: ActionType;
  description: string;
}

export interface GotoAction extends BaseAction {
  type: 'goto';
  url: string;
}

export interface ClickAction extends BaseAction {
  type: 'click';
  index: number;
}

export interface TypeAction extends BaseAction {
  type: 'type';
  index: number;
  text: string;
}

export interface ScrollAction extends BaseAction {
  type: 'scroll';
  index: number;
}

export interface CompleteAction extends BaseAction {
  type: 'complete';
  summary: string;
  evaluation: 'success' | 'failed' | 'partial';
}

export type Action = GotoAction | ClickAction | TypeAction | ScrollAction | CompleteAction;

export interface ActionResult {
  success: boolean;
  error?: string;
  currentUrl: string;
  screenshot: string;
  pageState?: {
    title: string;
    elements: string;
    scrollPosition: {
      x: number;
      y: number;
    };
  };
}

export interface BrowserState {
  url: string | null;
  title: string | null;
  elements: string;
  scrollPosition: {
    x: number;
    y: number;
  };
  screenshot: string | null;
} 