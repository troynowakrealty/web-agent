export type ActionType = 'goto' | 'click' | 'type' | 'complete';

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
  selector?: string;
  text?: string;
}

export interface TypeAction extends BaseAction {
  type: 'type';
  selector: string;
  text: string;
}

export interface CompleteAction extends BaseAction {
  type: 'complete';
}

export type Action = GotoAction | ClickAction | TypeAction | CompleteAction;

export interface ActionResult {
  success: boolean;
  error?: string;
  currentUrl: string;
  screenshot: string;
} 