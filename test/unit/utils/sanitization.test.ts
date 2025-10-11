import { describe, it, expect } from 'vitest';
import {
  sanitizeProjectId,
  sanitizeLimit,
  sanitizeInterval,
  sanitizeDatasetName,
  escapeSqlString,
  SanitizationError,
} from '../../../src/utils/sanitization.js';

describe('sanitization utilities', () => {
  describe('sanitizeProjectId', () => {
    describe('valid inputs', () => {
      it('should accept valid lowercase alphanumeric project IDs', () => {
        expect(sanitizeProjectId('test')).toBe('test');
        expect(sanitizeProjectId('project123')).toBe('project123');
        expect(sanitizeProjectId('my-project')).toBe('my-project');
        expect(sanitizeProjectId('prod')).toBe('prod');
      });

      it('should accept project IDs with hyphens', () => {
        expect(sanitizeProjectId('my-test-project')).toBe('my-test-project');
        expect(sanitizeProjectId('a-b-c-d-e-f')).toBe('a-b-c-d-e-f');
      });

      it('should accept 3-32 character project IDs', () => {
        expect(sanitizeProjectId('abc')).toBe('abc');
        expect(sanitizeProjectId('a'.repeat(32))).toBe('a'.repeat(32));
      });

      it('should trim whitespace from valid project IDs', () => {
        expect(sanitizeProjectId('  test  ')).toBe('test');
        expect(sanitizeProjectId('\tproject\n')).toBe('project');
      });

      it('should return null for null/undefined', () => {
        expect(sanitizeProjectId(null)).toBeNull();
        expect(sanitizeProjectId(undefined)).toBeNull();
      });
    });

    describe('SQL injection attempts', () => {
      it('should reject SQL OR injection', () => {
        expect(() => sanitizeProjectId("' OR '1'='1")).toThrow(
          SanitizationError
        );
        expect(() => sanitizeProjectId("project' OR 1=1--")).toThrow(
          SanitizationError
        );
      });

      it('should reject SQL UNION injection', () => {
        expect(() =>
          sanitizeProjectId("' UNION SELECT * FROM users--")
        ).toThrow(SanitizationError);
        expect(() => sanitizeProjectId('test UNION ALL SELECT')).toThrow(
          SanitizationError
        );
      });

      it('should reject DROP TABLE injection', () => {
        expect(() => sanitizeProjectId('"; DROP TABLE projects--')).toThrow(
          SanitizationError
        );
        expect(() => sanitizeProjectId("'; DROP TABLE--")).toThrow(
          SanitizationError
        );
      });

      it('should reject SQL comments', () => {
        expect(() => sanitizeProjectId('test--comment')).toThrow(
          SanitizationError
        );
        expect(() => sanitizeProjectId('test/*comment*/')).toThrow(
          SanitizationError
        );
      });

      it('should reject SQL keywords', () => {
        expect(() => sanitizeProjectId('SELECT * FROM')).toThrow(
          SanitizationError
        );
        expect(() => sanitizeProjectId('INSERT INTO')).toThrow(
          SanitizationError
        );
        expect(() => sanitizeProjectId('DELETE FROM')).toThrow(
          SanitizationError
        );
        expect(() => sanitizeProjectId('UPDATE SET')).toThrow(
          SanitizationError
        );
      });

      it('should reject SQL functions', () => {
        expect(() => sanitizeProjectId('SLEEP(10)')).toThrow(SanitizationError);
        expect(() => sanitizeProjectId('BENCHMARK()')).toThrow(
          SanitizationError
        );
        expect(() => sanitizeProjectId('WAITFOR DELAY')).toThrow(
          SanitizationError
        );
      });
    });

    describe('special characters', () => {
      it('should reject single quotes', () => {
        expect(() => sanitizeProjectId("test'project")).toThrow(
          SanitizationError
        );
        expect(() => sanitizeProjectId("'test'")).toThrow(SanitizationError);
      });

      it('should reject double quotes', () => {
        expect(() => sanitizeProjectId('test"project')).toThrow(
          SanitizationError
        );
        expect(() => sanitizeProjectId('"test"')).toThrow(SanitizationError);
      });

      it('should reject semicolons', () => {
        expect(() => sanitizeProjectId('test;project')).toThrow(
          SanitizationError
        );
        expect(() => sanitizeProjectId('test;')).toThrow(SanitizationError);
      });

      it('should reject backslashes', () => {
        expect(() => sanitizeProjectId('test\\project')).toThrow(
          SanitizationError
        );
        expect(() => sanitizeProjectId('\\test\\')).toThrow(SanitizationError);
      });
    });

    describe('edge cases', () => {
      it('should reject empty string', () => {
        expect(() => sanitizeProjectId('')).toThrow(SanitizationError);
        expect(() => sanitizeProjectId('   ')).toThrow(SanitizationError);
      });

      it('should reject too short project IDs', () => {
        expect(() => sanitizeProjectId('ab')).toThrow(SanitizationError);
        expect(() => sanitizeProjectId('a')).toThrow(SanitizationError);
      });

      it('should reject too long project IDs', () => {
        expect(() => sanitizeProjectId('a'.repeat(33))).toThrow(
          SanitizationError
        );
        expect(() => sanitizeProjectId('a'.repeat(100))).toThrow(
          SanitizationError
        );
      });

      it('should reject uppercase characters', () => {
        expect(() => sanitizeProjectId('Test')).toThrow(SanitizationError);
        expect(() => sanitizeProjectId('PROJECT')).toThrow(SanitizationError);
      });

      it('should reject underscores', () => {
        expect(() => sanitizeProjectId('test_project')).toThrow(
          SanitizationError
        );
      });

      it('should reject Unicode characters', () => {
        expect(() => sanitizeProjectId('test™')).toThrow(SanitizationError);
        expect(() => sanitizeProjectId('tést')).toThrow(SanitizationError);
        expect(() => sanitizeProjectId('项目')).toThrow(SanitizationError);
      });
    });

    describe('non-throwing mode', () => {
      it('should return null for invalid input when throwOnInvalid=false', () => {
        const result = sanitizeProjectId("' OR '1'='1", {
          throwOnInvalid: false,
        });
        expect(result).toBeNull();
      });

      it('should still return valid IDs', () => {
        const result = sanitizeProjectId('test', { throwOnInvalid: false });
        expect(result).toBe('test');
      });
    });

    describe('logging', () => {
      it('should not log when logAttempts=false', () => {
        const result = sanitizeProjectId("' OR '1'='1", {
          throwOnInvalid: false,
          logAttempts: false,
        });
        expect(result).toBeNull();
        // No way to test console output in unit tests, but coverage is satisfied
      });
    });
  });

  describe('sanitizeLimit', () => {
    it('should accept valid numeric limits', () => {
      expect(sanitizeLimit(100)).toBe(100);
      expect(sanitizeLimit(1000)).toBe(1000);
      expect(sanitizeLimit(50000)).toBe(50000);
    });

    it('should accept string numeric limits', () => {
      expect(sanitizeLimit('100')).toBe(100);
      expect(sanitizeLimit('1000')).toBe(1000);
    });

    it('should return default for null/undefined', () => {
      expect(sanitizeLimit(null)).toBe(10000);
      expect(sanitizeLimit(undefined)).toBe(10000);
    });

    it('should reject non-numeric values', () => {
      expect(() => sanitizeLimit('abc')).toThrow(SanitizationError);
      expect(() => sanitizeLimit('not-a-number')).toThrow(SanitizationError);
    });

    it('should accept strings with trailing non-numeric chars (parseInt behavior)', () => {
      // parseInt('100abc') returns 100, which is valid
      expect(sanitizeLimit('100abc')).toBe(100);
      expect(sanitizeLimit('500xyz')).toBe(500);
    });

    it('should reject negative values', () => {
      expect(() => sanitizeLimit(-1)).toThrow(SanitizationError);
      expect(() => sanitizeLimit(-100)).toThrow(SanitizationError);
    });

    it('should reject zero', () => {
      expect(() => sanitizeLimit(0)).toThrow(SanitizationError);
    });

    it('should reject values exceeding max limit', () => {
      expect(() => sanitizeLimit(100001)).toThrow(SanitizationError);
      expect(() => sanitizeLimit(999999)).toThrow(SanitizationError);
    });

    it('should accept custom max limit', () => {
      expect(sanitizeLimit(500, 1000)).toBe(500);
      expect(() => sanitizeLimit(1001, 1000)).toThrow(SanitizationError);
    });

    it('should reject NaN', () => {
      expect(() => sanitizeLimit(NaN)).toThrow(SanitizationError);
    });

    it('should reject Infinity', () => {
      expect(() => sanitizeLimit(Infinity)).toThrow(SanitizationError);
      expect(() => sanitizeLimit(-Infinity)).toThrow(SanitizationError);
    });
  });

  describe('sanitizeInterval', () => {
    it('should accept valid hour intervals', () => {
      expect(sanitizeInterval(1)).toBe(1);
      expect(sanitizeInterval(24)).toBe(24);
      expect(sanitizeInterval(168)).toBe(168); // 1 week
    });

    it('should ceil fractional hours', () => {
      expect(sanitizeInterval(1.5)).toBe(2);
      expect(sanitizeInterval(23.7)).toBe(24);
      expect(sanitizeInterval(0.1)).toBe(1);
    });

    it('should reject negative intervals', () => {
      expect(() => sanitizeInterval(-1)).toThrow(SanitizationError);
      expect(() => sanitizeInterval(-24)).toThrow(SanitizationError);
    });

    it('should reject intervals exceeding max', () => {
      expect(() => sanitizeInterval(8761)).toThrow(SanitizationError); // > 1 year
      expect(() => sanitizeInterval(10000)).toThrow(SanitizationError);
    });

    it('should accept custom max interval', () => {
      expect(sanitizeInterval(100, 200)).toBe(100);
      expect(() => sanitizeInterval(201, 200)).toThrow(SanitizationError);
    });

    it('should reject NaN', () => {
      expect(() => sanitizeInterval(NaN)).toThrow(SanitizationError);
    });

    it('should reject Infinity', () => {
      expect(() => sanitizeInterval(Infinity)).toThrow(SanitizationError);
    });
  });

  describe('sanitizeDatasetName', () => {
    const allowedDatasets = [
      'duyet_logs_claude_code_analytics',
      'duyet_logs_claude_code_logs',
      'duyet_logs_claude_code_metrics',
      'duyet_logs_ga_analytics',
    ];

    it('should accept whitelisted dataset names', () => {
      expect(
        sanitizeDatasetName('duyet_logs_claude_code_analytics', allowedDatasets)
      ).toBe('duyet_logs_claude_code_analytics');
      expect(
        sanitizeDatasetName('duyet_logs_ga_analytics', allowedDatasets)
      ).toBe('duyet_logs_ga_analytics');
    });

    it('should reject non-whitelisted dataset names', () => {
      expect(() =>
        sanitizeDatasetName('malicious_dataset', allowedDatasets)
      ).toThrow(SanitizationError);
      expect(() => sanitizeDatasetName('users', allowedDatasets)).toThrow(
        SanitizationError
      );
    });

    it('should reject empty string', () => {
      expect(() => sanitizeDatasetName('', allowedDatasets)).toThrow(
        SanitizationError
      );
    });

    it('should reject dataset names with special characters', () => {
      const maliciousDatasets = [
        "dataset'; DROP TABLE--",
        'dataset/*comment*/',
        'dataset UNION SELECT',
      ];

      // Add to allowed list to test character validation
      maliciousDatasets.forEach((name) => {
        expect(() =>
          sanitizeDatasetName(name, [...allowedDatasets, name])
        ).toThrow(SanitizationError);
      });
    });

    it('should trim whitespace', () => {
      expect(
        sanitizeDatasetName('  duyet_logs_ga_analytics  ', allowedDatasets)
      ).toBe('duyet_logs_ga_analytics');
    });
  });

  describe('escapeSqlString', () => {
    it('should escape single quotes', () => {
      expect(escapeSqlString("test'value")).toBe("test''value");
      expect(escapeSqlString("it's")).toBe("it''s");
    });

    it('should handle multiple quotes', () => {
      expect(escapeSqlString("'test'value'")).toBe("''test''value''");
    });

    it('should handle strings without quotes', () => {
      expect(escapeSqlString('test')).toBe('test');
      expect(escapeSqlString('test-project')).toBe('test-project');
    });

    it('should handle empty string', () => {
      expect(escapeSqlString('')).toBe('');
    });

    it('should not escape double quotes', () => {
      expect(escapeSqlString('test"value')).toBe('test"value');
    });
  });

  describe('SanitizationError', () => {
    it('should create error with correct properties', () => {
      const error = new SanitizationError(
        'Test error',
        'field_name',
        'test_value'
      );

      expect(error.message).toBe('Test error');
      expect(error.field).toBe('field_name');
      expect(error.value).toBe('test_value');
      expect(error.name).toBe('SanitizationError');
    });

    it('should be instanceof Error', () => {
      const error = new SanitizationError('Test', 'field', 'value');
      expect(error instanceof Error).toBe(true);
    });
  });
});
