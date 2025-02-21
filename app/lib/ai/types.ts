import { ChatCompletionMessageParam } from 'openai/resources/chat';

export interface AIProvider {
  chat(messages: ChatMessage[]): Promise<string>;
  chatWithVision(messages: ChatMessage[], imageBase64: string): Promise<string>;
}

export type ChatMessageRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
}

export function toChatCompletionMessage(message: ChatMessage): ChatCompletionMessageParam {
  return {
    role: message.role,
    content: message.content
  };
}

export interface ChatMessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

export type AIProviderType = 'openai' | 'ollama';

export interface AIConfig {
  provider: AIProviderType;
  openai?: {
    apiKey: string;
    model: string;
    visionModel: string;
  };
  ollama?: {
    baseUrl: string;
    model: string;
    visionModel: string;
  };
} 