import { describe, it, expect } from 'vitest';
import { ClaudeCodeAdapter } from '../../../src/adapters/claude-code.js';
import type { ClaudeCodeMetric, ClaudeCodeEvent } from '../../../src/types/index.js';

describe('ClaudeCodeAdapter', () => {
  const adapter = new ClaudeCodeAdapter();

  describe('validate', () => {
    it('should validate metric format', () => {
      const metric: ClaudeCodeMetric = {
        session_id: 'session-123',
        metric_name: 'claude_code.token.usage',
        value: 100,
      };
      expect(adapter.validate(metric)).toBe(true);
    });

    it('should validate event format', () => {
      const event: ClaudeCodeEvent = {
        event_name: 'user_prompt',
        timestamp: '2024-01-01T00:00:00Z',
        session_id: 'session-123',
        attributes: { test: 'value' },
      };
      expect(adapter.validate(event)).toBe(true);
    });

    it('should reject invalid data', () => {
      expect(adapter.validate(null)).toBe(false);
      expect(adapter.validate({})).toBe(false);
      expect(adapter.validate({ session_id: 'test' })).toBe(false);
      expect(adapter.validate({ metric_name: 'test', value: 'not-a-number' })).toBe(false);
    });
  });

  describe('transform - metrics', () => {
    it('should transform basic metric', () => {
      const metric: ClaudeCodeMetric = {
        session_id: 'session-123',
        metric_name: 'claude_code.token.usage',
        value: 100,
      };

      const result = adapter.transform(metric);

      expect(result.indexes).toContain('session-123');
      expect(result.indexes).toContain('claude_code.token.usage');
      expect(result.doubles).toEqual([100]);
    });

    it('should include optional metric fields', () => {
      const metric: ClaudeCodeMetric = {
        session_id: 'session-123',
        metric_name: 'claude_code.token.usage',
        value: 100,
        app_version: '1.0.0',
        organization_id: 'org-123',
        user_account_uuid: 'user-123',
        timestamp: '2024-01-01T00:00:00Z',
        attributes: {
          type: 'input',
          model: 'claude-3',
          tool: 'Edit',
          decision: 'accept',
          language: 'TypeScript',
        },
      };

      const result = adapter.transform(metric);

      expect(result.indexes).toContain('1.0.0');
      expect(result.indexes).toContain('org-123');
      expect(result.indexes).toContain('user-123');
      expect(result.indexes).toContain('input');
      expect(result.indexes).toContain('claude-3');
      expect(result.indexes).toContain('Edit');
      expect(result.indexes).toContain('accept');
      expect(result.indexes).toContain('TypeScript');
      expect(result.blobs).toContain('2024-01-01T00:00:00Z');
    });

    it('should handle metrics with partial attributes', () => {
      const metric: ClaudeCodeMetric = {
        session_id: 'session-123',
        metric_name: 'claude_code.cost.usage',
        value: 0.05,
        attributes: {
          model: 'claude-3',
        },
      };

      const result = adapter.transform(metric);

      expect(result.indexes).toContain('claude-3');
      expect(result.doubles).toEqual([0.05]);
    });
  });

  describe('transform - events', () => {
    it('should transform basic event', () => {
      const event: ClaudeCodeEvent = {
        event_name: 'user_prompt',
        timestamp: '2024-01-01T00:00:00Z',
        session_id: 'session-123',
        attributes: { prompt_length: 100 },
      };

      const result = adapter.transform(event);

      expect(result.indexes).toContain('session-123');
      expect(result.indexes).toContain('user_prompt');
      expect(result.blobs).toContain('2024-01-01T00:00:00Z');
      expect(result.blobs?.some((blob) => blob.includes('prompt_length'))).toBe(true);
      expect(result.doubles).toEqual([]);
    });

    it('should serialize event attributes as JSON', () => {
      const event: ClaudeCodeEvent = {
        event_name: 'tool_result',
        timestamp: '2024-01-01T00:00:00Z',
        session_id: 'session-123',
        attributes: {
          tool_name: 'Read',
          success: true,
          duration_ms: 50,
        },
      };

      const result = adapter.transform(event);

      const attributesBlob = result.blobs?.find((blob) => blob.includes('tool_name'));
      expect(attributesBlob).toBeDefined();
      if (attributesBlob) {
        const parsed = JSON.parse(attributesBlob);
        expect(parsed.tool_name).toBe('Read');
        expect(parsed.success).toBe(true);
        expect(parsed.duration_ms).toBe(50);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty attributes', () => {
      const metric: ClaudeCodeMetric = {
        session_id: 'session-123',
        metric_name: 'test',
        value: 1,
        attributes: {},
      };

      const result = adapter.transform(metric);
      expect(result).toBeDefined();
    });

    it('should handle very long session IDs', () => {
      const longId = 'a'.repeat(200);
      const metric: ClaudeCodeMetric = {
        session_id: longId,
        metric_name: 'test',
        value: 1,
      };

      const result = adapter.transform(metric);
      const firstIndex = result.indexes?.[0];
      expect(firstIndex).toBeDefined();
      if (firstIndex) {
        expect(firstIndex.length).toBeLessThanOrEqual(96);
      }
    });
  });
});
