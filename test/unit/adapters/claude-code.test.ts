/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect } from 'vitest';
import { ClaudeCodeAdapter } from '../../../src/adapters/claude-code.js';
import type {
  ClaudeCodeMetric,
  ClaudeCodeEvent,
} from '../../../src/types/index.js';

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
      expect(
        adapter.validate({ metric_name: 'test', value: 'not-a-number' })
      ).toBe(false);
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

      // No project_id means indexes should be empty
      expect(result.indexes).toEqual([]);
      expect(result.doubles).toEqual([100]);

      // All metadata is in blobs[0] as JSON
      expect(result.blobs).toBeDefined();
      expect(result.blobs?.length).toBe(1);
      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.session_id).toBe('session-123');
      expect(metadata.metric_name).toBe('claude_code.token.usage');
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

      // No project_id means indexes should be empty
      expect(result.indexes).toEqual([]);

      // All metadata is in blobs[0] as JSON
      expect(result.blobs).toBeDefined();
      expect(result.blobs?.length).toBe(1);
      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.app_version).toBe('1.0.0');
      expect(metadata.organization_id).toBe('org-123');
      expect(metadata.user_account_uuid).toBe('user-123');
      expect(metadata.timestamp).toBe('2024-01-01T00:00:00Z');
      expect(metadata.attributes.type).toBe('input');
      expect(metadata.attributes.model).toBe('claude-3');
      expect(metadata.attributes.tool).toBe('Edit');
      expect(metadata.attributes.decision).toBe('accept');
      expect(metadata.attributes.language).toBe('TypeScript');
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

      // No project_id means indexes should be empty
      expect(result.indexes).toEqual([]);
      expect(result.doubles).toEqual([0.05]);

      // Check metadata in blobs[0]
      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.attributes.model).toBe('claude-3');
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

      // No project_id means indexes should be empty
      expect(result.indexes).toEqual([]);
      expect(result.doubles).toEqual([]);

      // All metadata is in blobs[0] as JSON
      expect(result.blobs).toBeDefined();
      expect(result.blobs?.length).toBe(1);
      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.session_id).toBe('session-123');
      expect(metadata.event_name).toBe('user_prompt');
      expect(metadata.timestamp).toBe('2024-01-01T00:00:00Z');
      expect(metadata.attributes.prompt_length).toBe(100);
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

      // All metadata is in blobs[0] as JSON
      expect(result.blobs).toBeDefined();
      expect(result.blobs?.length).toBe(1);
      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.attributes.tool_name).toBe('Read');
      expect(metadata.attributes.success).toBe(true);
      expect(metadata.attributes.duration_ms).toBe(50);
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

      // No project_id means indexes should be empty
      expect(result.indexes).toEqual([]);

      // Session ID is in metadata, not truncated
      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.session_id).toBe(longId);
    });
  });

  describe('project_id support', () => {
    it('should include project_id in metric indexes as first element', () => {
      const metric: ClaudeCodeMetric = {
        session_id: 'session-123',
        metric_name: 'claude_code.token.usage',
        value: 100,
        project_id: 'proj123',
      };

      const result = adapter.transform(metric);

      // Only project_id in indexes
      expect(result.indexes).toEqual(['proj123']);

      // Other fields are in metadata
      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.session_id).toBe('session-123');
      expect(metadata.metric_name).toBe('claude_code.token.usage');
    });

    it('should include project_id in event indexes as first element', () => {
      const event: ClaudeCodeEvent = {
        event_name: 'user_prompt',
        timestamp: '2024-01-01T00:00:00Z',
        session_id: 'session-123',
        project_id: 'proj456',
        attributes: { test: 'value' },
      };

      const result = adapter.transform(event);

      // Only project_id in indexes
      expect(result.indexes).toEqual(['proj456']);

      // Other fields are in metadata
      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.session_id).toBe('session-123');
      expect(metadata.event_name).toBe('user_prompt');
    });

    it('should work without project_id', () => {
      const metric: ClaudeCodeMetric = {
        session_id: 'session-123',
        metric_name: 'test',
        value: 1,
      };

      const result = adapter.transform(metric);

      // No project_id means empty indexes
      expect(result.indexes).toEqual([]);

      // Data is in metadata
      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.session_id).toBe('session-123');
    });
  });
});
