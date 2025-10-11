import { describe, it, expect, beforeEach } from 'vitest';
import { SelfTrackingAdapter } from '../../../src/adapters/self-tracking.js';
import type { SelfTrackingRequestData } from '../../../src/types/self-tracking.js';

describe('SelfTrackingAdapter', () => {
  let adapter: SelfTrackingAdapter;

  beforeEach(() => {
    adapter = new SelfTrackingAdapter();
  });

  describe('validate', () => {
    it('should accept valid minimal data', () => {
      const data: SelfTrackingRequestData = {
        timestamp: Date.now(),
        endpoint: '/cc',
        method: 'POST',
        status: 200,
        response_time_ms: 42,
      };

      expect(adapter.validate(data)).toBe(true);
    });

    it('should accept valid complete data', () => {
      const data: SelfTrackingRequestData = {
        timestamp: Date.now(),
        endpoint: '/cc/myproject',
        method: 'POST',
        status: 200,
        response_time_ms: 42,
        project_id: 'myproject',
        user_agent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        cf_ray: '8b1234567890abcd-SJC',
        cf_country: 'US',
        cf_ip: '1.2.3.4',
      };

      expect(adapter.validate(data)).toBe(true);
    });

    it('should accept valid error data', () => {
      const data: SelfTrackingRequestData = {
        timestamp: Date.now(),
        endpoint: '/cc',
        method: 'POST',
        status: 500,
        response_time_ms: 100,
        error_message: 'Internal Server Error',
        error_stack: 'Error: Something went wrong\n  at handler (app.ts:42)',
      };

      expect(adapter.validate(data)).toBe(true);
    });

    it('should reject non-object data', () => {
      expect(adapter.validate(null)).toBe(false);
      expect(adapter.validate(undefined)).toBe(false);
      expect(adapter.validate('string')).toBe(false);
      expect(adapter.validate(123)).toBe(false);
      expect(adapter.validate([])).toBe(false);
    });

    it('should reject data missing required fields', () => {
      expect(adapter.validate({})).toBe(false);
      expect(
        adapter.validate({
          timestamp: Date.now(),
          endpoint: '/cc',
          method: 'POST',
          status: 200,
          // missing response_time_ms
        })
      ).toBe(false);
      expect(
        adapter.validate({
          timestamp: Date.now(),
          endpoint: '/cc',
          method: 'POST',
          // missing status and response_time_ms
        })
      ).toBe(false);
    });

    it('should reject data with invalid field types', () => {
      expect(
        adapter.validate({
          timestamp: 'not a number',
          endpoint: '/cc',
          method: 'POST',
          status: 200,
          response_time_ms: 42,
        })
      ).toBe(false);

      expect(
        adapter.validate({
          timestamp: Date.now(),
          endpoint: 123, // should be string
          method: 'POST',
          status: 200,
          response_time_ms: 42,
        })
      ).toBe(false);

      expect(
        adapter.validate({
          timestamp: Date.now(),
          endpoint: '/cc',
          method: 'POST',
          status: '200', // should be number
          response_time_ms: 42,
        })
      ).toBe(false);
    });

    it('should reject data with invalid optional field types', () => {
      expect(
        adapter.validate({
          timestamp: Date.now(),
          endpoint: '/cc',
          method: 'POST',
          status: 200,
          response_time_ms: 42,
          project_id: 123, // should be string
        })
      ).toBe(false);

      expect(
        adapter.validate({
          timestamp: Date.now(),
          endpoint: '/cc',
          method: 'POST',
          status: 200,
          response_time_ms: 42,
          user_agent: 123, // should be string
        })
      ).toBe(false);

      expect(
        adapter.validate({
          timestamp: Date.now(),
          endpoint: '/cc',
          method: 'POST',
          status: 200,
          response_time_ms: 42,
          cf_ray: true, // should be string
        })
      ).toBe(false);

      expect(
        adapter.validate({
          timestamp: Date.now(),
          endpoint: '/cc',
          method: 'POST',
          status: 200,
          response_time_ms: 42,
          error_message: { error: 'test' }, // should be string
        })
      ).toBe(false);
    });
  });

  describe('transform', () => {
    it('should transform minimal data correctly', () => {
      const data: SelfTrackingRequestData = {
        timestamp: 1704067200000,
        endpoint: '/cc',
        method: 'POST',
        status: 200,
        response_time_ms: 42,
      };

      const result = adapter.transform(data);

      // Check structure
      expect(result).toHaveProperty('indexes');
      expect(result).toHaveProperty('doubles');
      expect(result).toHaveProperty('blobs');

      // Should have no indexes (no project_id)
      expect(result.indexes).toEqual([]);

      // Should have 3 doubles: timestamp, status, response_time_ms
      expect(result.doubles).toHaveLength(3);
      expect(result.doubles?.[0]).toBe(1704067200000);
      expect(result.doubles?.[1]).toBe(200);
      expect(result.doubles?.[2]).toBe(42);

      // Should have 1 blob with JSON data
      expect(result.blobs).toHaveLength(1);
      const blobData = JSON.parse(result.blobs?.[0] || '{}');
      expect(blobData).toMatchObject({
        timestamp: 1704067200000,
        endpoint: '/cc',
        method: 'POST',
        status: 200,
        response_time_ms: 42,
        project_id: null,
        is_error: false,
        is_success: true,
      });
    });

    it('should transform complete data correctly', () => {
      const data: SelfTrackingRequestData = {
        timestamp: 1704067200000,
        endpoint: '/cc/myproject',
        method: 'POST',
        status: 200,
        response_time_ms: 42,
        project_id: 'myproject',
        user_agent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        cf_ray: '8b1234567890abcd-SJC',
        cf_country: 'US',
        cf_ip: '1.2.3.4',
      };

      const result = adapter.transform(data);

      // Should have project_id as index
      expect(result.indexes).toEqual(['myproject']);

      // Should have 3 doubles
      expect(result.doubles).toHaveLength(3);
      expect(result.doubles?.[0]).toBe(1704067200000);
      expect(result.doubles?.[1]).toBe(200);
      expect(result.doubles?.[2]).toBe(42);

      // Check blob data
      const blobData = JSON.parse(result.blobs?.[0] || '{}');
      expect(blobData).toMatchObject({
        timestamp: 1704067200000,
        endpoint: '/cc/myproject',
        method: 'POST',
        status: 200,
        response_time_ms: 42,
        project_id: 'myproject',
        is_error: false,
        is_success: true,
        user_agent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        cf_ray: '8b1234567890abcd-SJC',
        cf_country: 'US',
        cf_ip: '1.2.3.4',
      });
    });

    it('should transform error data correctly', () => {
      const data: SelfTrackingRequestData = {
        timestamp: 1704067200000,
        endpoint: '/cc',
        method: 'POST',
        status: 500,
        response_time_ms: 100,
        error_message: 'Internal Server Error',
        error_stack: 'Error: Something went wrong\n  at handler (app.ts:42)',
      };

      const result = adapter.transform(data);

      // Check blob data
      const blobData = JSON.parse(result.blobs?.[0] || '{}');
      expect(blobData).toMatchObject({
        status: 500,
        is_error: true,
        is_success: false,
        error_message: 'Internal Server Error',
      });
      // Check error_stack separately (newlines may be normalized)
      expect(blobData.error_stack).toContain('Error: Something went wrong');
      expect(blobData.error_stack).toContain('at handler (app.ts:42)');
    });

    it('should classify 4xx as errors', () => {
      const data: SelfTrackingRequestData = {
        timestamp: Date.now(),
        endpoint: '/cc',
        method: 'POST',
        status: 404,
        response_time_ms: 10,
      };

      const result = adapter.transform(data);
      const blobData = JSON.parse(result.blobs?.[0] || '{}');

      expect(blobData.is_error).toBe(true);
      expect(blobData.is_success).toBe(false);
    });

    it('should classify 2xx and 3xx as success', () => {
      const data200: SelfTrackingRequestData = {
        timestamp: Date.now(),
        endpoint: '/cc',
        method: 'POST',
        status: 200,
        response_time_ms: 10,
      };

      const result200 = adapter.transform(data200);
      const blobData200 = JSON.parse(result200.blobs?.[0] || '{}');
      expect(blobData200.is_error).toBe(false);
      expect(blobData200.is_success).toBe(true);

      const data301: SelfTrackingRequestData = {
        timestamp: Date.now(),
        endpoint: '/cc',
        method: 'GET',
        status: 301,
        response_time_ms: 5,
      };

      const result301 = adapter.transform(data301);
      const blobData301 = JSON.parse(result301.blobs?.[0] || '{}');
      expect(blobData301.is_error).toBe(false);
      expect(blobData301.is_success).toBe(true);
    });

    it('should use project_id from context if not in data', () => {
      adapter.setProjectId('context-project');

      const data: SelfTrackingRequestData = {
        timestamp: Date.now(),
        endpoint: '/cc',
        method: 'POST',
        status: 200,
        response_time_ms: 42,
      };

      const result = adapter.transform(data);

      expect(result.indexes).toEqual(['context-project']);

      const blobData = JSON.parse(result.blobs?.[0] || '{}');
      expect(blobData.project_id).toBe('context-project');
    });

    it('should prefer data project_id over context project_id', () => {
      adapter.setProjectId('context-project');

      const data: SelfTrackingRequestData = {
        timestamp: Date.now(),
        endpoint: '/cc/myproject',
        method: 'POST',
        status: 200,
        response_time_ms: 42,
        project_id: 'myproject',
      };

      const result = adapter.transform(data);

      expect(result.indexes).toEqual(['myproject']);

      const blobData = JSON.parse(result.blobs?.[0] || '{}');
      expect(blobData.project_id).toBe('myproject');
    });

    it('should truncate long project_id to 96 bytes', () => {
      const longProjectId = 'a'.repeat(200);

      const data: SelfTrackingRequestData = {
        timestamp: Date.now(),
        endpoint: '/cc',
        method: 'POST',
        status: 200,
        response_time_ms: 42,
        project_id: longProjectId,
      };

      const result = adapter.transform(data);

      // Index should be truncated to 96 bytes
      expect(result.indexes?.[0]?.length).toBeLessThanOrEqual(96);
      expect(result.indexes?.[0]).toBe('a'.repeat(96));
    });

    it('should truncate long error stack to 2000 bytes', () => {
      const longStack = 'Error: Test\n' + '  at line\n'.repeat(500);

      const data: SelfTrackingRequestData = {
        timestamp: Date.now(),
        endpoint: '/cc',
        method: 'POST',
        status: 500,
        response_time_ms: 100,
        error_stack: longStack,
      };

      const result = adapter.transform(data);
      const blobData = JSON.parse(result.blobs?.[0] || '{}');

      // Error stack should be truncated to 2000 bytes
      expect(blobData.error_stack.length).toBeLessThanOrEqual(2000);
    });

    it('should truncate entire blob to 5120 bytes if needed', () => {
      // Create data that would exceed blob limit
      const longUserAgent = 'Mozilla/5.0 ' + 'A'.repeat(6000);

      const data: SelfTrackingRequestData = {
        timestamp: Date.now(),
        endpoint: '/cc',
        method: 'POST',
        status: 200,
        response_time_ms: 42,
        user_agent: longUserAgent,
      };

      const result = adapter.transform(data);

      // Blob should be truncated to 5120 bytes
      expect(result.blobs?.[0]?.length).toBeLessThanOrEqual(5120);
    });

    it('should handle NaN and invalid numeric values', () => {
      const data: SelfTrackingRequestData = {
        timestamp: NaN,
        endpoint: '/cc',
        method: 'POST',
        status: NaN,
        response_time_ms: NaN,
      };

      const result = adapter.transform(data);

      // Should convert NaN to 0
      expect(result.doubles).toEqual([0, 0, 0]);
    });
  });
});
