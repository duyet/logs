import type { EndpointConfig } from '../types/index.js';

/**
 * Endpoint configuration
 */
export const endpoints: EndpointConfig[] = [
  {
    path: '/cc',
    dataset: 'CLAUDE_CODE_ANALYTICS',
    methods: ['GET', 'POST'],
  },
  {
    path: '/ga',
    dataset: 'GA_ANALYTICS',
    methods: ['GET', 'POST'],
  },
];
