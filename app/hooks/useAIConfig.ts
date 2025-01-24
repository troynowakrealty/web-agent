import { useEffect, useState } from 'react';
import type { AIConfig } from '../lib/ai/types';

export function useAIConfig() {
  const [config, setConfig] = useState<AIConfig | null>(null);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const response = await fetch('/api/ai-config');
        const data = await response.json();
        setConfig(data);
      } catch (error) {
        console.error('Failed to fetch AI config:', error);
      }
    }

    fetchConfig();
  }, []);

  return config;
} 