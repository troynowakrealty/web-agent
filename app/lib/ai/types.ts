export interface AIProvider {
  chat(messages: ChatMessage[]): Promise<string>;
  chatWithVision(messages: ChatMessage[], imageBase64: string): Promise<string>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatMessageContent[];
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