import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRouter } from '../../src/routes/router.js';
import type {
  Env,
  SuccessResponse,
  ErrorResponse,
  ProjectCreateResponse,
  ProjectListResponse,
} from '../../src/types/index.js';

interface MockD1Result {
  mockDB: D1Database;
  statement: {
    bind: ReturnType<typeof vi.fn>;
    first: ReturnType<typeof vi.fn>;
    run: ReturnType<typeof vi.fn>;
    all: ReturnType<typeof vi.fn>;
  };
}

// Mock D1 Database
function createMockD1(): MockD1Result {
  const statement = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(),
    run: vi.fn(),
    all: vi.fn(),
  };

  const mockDB = {
    prepare: vi.fn().mockReturnValue(statement),
  } as unknown as D1Database;

  return { mockDB, statement };
}

describe('Projects API E2E', () => {
  let mockDB: D1Database;
  let statement: ReturnType<typeof createMockD1>['statement'];
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    const mock = createMockD1();
    mockDB = mock.mockDB;
    statement = mock.statement;
    env = {
      DB: mockDB,
      CLAUDE_CODE_ANALYTICS: {} as never,
      CLAUDE_CODE_LOGS: {} as never,
      CLAUDE_CODE_METRICS: {} as never,
      GA_ANALYTICS: {} as never,
      LOGTAIL_ANALYTICS: {} as never,
      SENTRY_ANALYTICS: {} as never,
    };
  });

  describe('POST /api/project', () => {
    it('should create project with custom ID', async () => {
      // Mock: ID doesn't exist
      statement.first.mockResolvedValueOnce(null);
      // Mock: INSERT successful
      statement.run.mockResolvedValueOnce({});

      const app = createRouter();
      const request = new Request('http://localhost/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'custom123',
          description: 'My Custom Project',
        }),
      });

      const response = await app.fetch(request, env);
      const data = (await response.json()) as
        | ProjectCreateResponse
        | ErrorResponse;

      expect(response.status).toBe(201);
      if ('success' in data && data.success) {
        expect(data.success).toBe(true);
        expect(data.project.id).toBe('custom123');
        expect(data.project.description).toBe('My Custom Project');
        expect(data.project.created_at).toBeGreaterThan(0);
        expect(data.project.last_used).toBeNull();
      }
    });

    it('should create project with auto-generated ID', async () => {
      statement.first.mockResolvedValueOnce(null);
      statement.run.mockResolvedValueOnce({});

      const app = createRouter();
      const request = new Request('http://localhost/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: 'Auto-generated ID Project',
        }),
      });

      const response = await app.fetch(request, env);
      const data = (await response.json()) as
        | ProjectCreateResponse
        | ErrorResponse;

      expect(response.status).toBe(201);
      if ('success' in data && data.success) {
        expect(data.success).toBe(true);
        expect(data.project.id).toMatch(/^[a-z0-9]{8}$/);
        expect(data.project.description).toBe('Auto-generated ID Project');
      }
    });

    it('should return 400 for missing description', async () => {
      const app = createRouter();
      const request = new Request('http://localhost/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await app.fetch(request, env);
      const data = (await response.json()) as SuccessResponse | ErrorResponse;

      expect(response.status).toBe(400);
      if ('error' in data) {
        expect(data.error).toBe('Bad Request');
        expect(data.message).toContain('description');
      }
    });

    it('should return 400 for empty description', async () => {
      const app = createRouter();
      const request = new Request('http://localhost/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: '   ' }),
      });

      const response = await app.fetch(request, env);
      const data = (await response.json()) as SuccessResponse | ErrorResponse;

      expect(response.status).toBe(400);
      if ('error' in data) {
        expect(data.error).toBe('Bad Request');
        expect(data.message).toContain('cannot be empty');
      }
    });

    it('should return 400 for duplicate ID', async () => {
      // Mock: ID already exists
      statement.first.mockResolvedValueOnce({ id: 'existing' });

      const app = createRouter();
      const request = new Request('http://localhost/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'existing',
          description: 'Duplicate',
        }),
      });

      const response = await app.fetch(request, env);
      const data = (await response.json()) as SuccessResponse | ErrorResponse;

      expect(response.status).toBe(400);
      if ('error' in data) {
        expect(data.error).toBe('Bad Request');
        expect(data.message).toContain('already exists');
      }
    });

    it('should return 400 for invalid ID format', async () => {
      const app = createRouter();
      const request = new Request('http://localhost/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'INVALID-ID!',
          description: 'Invalid',
        }),
      });

      const response = await app.fetch(request, env);
      const data = (await response.json()) as SuccessResponse | ErrorResponse;

      expect(response.status).toBe(400);
      if ('error' in data) {
        expect(data.error).toBe('Bad Request');
        expect(data.message).toContain('Invalid project ID format');
      }
    });

    it('should return 400 on database error', async () => {
      statement.first.mockResolvedValueOnce(null);
      statement.run.mockRejectedValueOnce(
        new Error('Database insertion failed')
      );

      const app = createRouter();
      const request = new Request('http://localhost/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'testproj',
          description: 'Test Project',
        }),
      });

      const response = await app.fetch(request, env);
      const data = (await response.json()) as SuccessResponse | ErrorResponse;

      expect(response.status).toBe(400);
      if ('error' in data) {
        expect(data.error).toBe('Bad Request');
        expect(data.message).toBe('Database insertion failed');
      }
    });
  });

  describe('GET /api/project', () => {
    it('should list all projects', async () => {
      const mockProjects = [
        {
          id: 'proj1',
          description: 'Project 1',
          created_at: 3,
          last_used: null,
        },
        { id: 'proj2', description: 'Project 2', created_at: 2, last_used: 1 },
        {
          id: 'proj3',
          description: 'Project 3',
          created_at: 1,
          last_used: null,
        },
      ];

      statement.all.mockResolvedValueOnce({ results: mockProjects });

      const app = createRouter();
      const request = new Request('http://localhost/api/project');

      const response = await app.fetch(request, env);
      const data = (await response.json()) as
        | ProjectListResponse
        | ErrorResponse;

      expect(response.status).toBe(200);
      if ('success' in data && data.success) {
        expect(data.success).toBe(true);
        expect(data.projects).toHaveLength(3);
        expect(data.total).toBe(3);
        expect(data.projects[0]?.id).toBe('proj1');
      }
    });

    it('should handle empty project list', async () => {
      statement.all.mockResolvedValueOnce({ results: [] });

      const app = createRouter();
      const request = new Request('http://localhost/api/project');

      const response = await app.fetch(request, env);
      const data = (await response.json()) as
        | ProjectListResponse
        | ErrorResponse;

      expect(response.status).toBe(200);
      if ('success' in data && data.success) {
        expect(data.success).toBe(true);
        expect(data.projects).toHaveLength(0);
        expect(data.total).toBe(0);
      }
    });

    it('should support pagination with limit and offset', async () => {
      statement.all.mockResolvedValueOnce({
        results: [
          {
            id: 'proj2',
            description: 'Project 2',
            created_at: 2,
            last_used: null,
          },
        ],
      });

      const app = createRouter();
      const request = new Request(
        'http://localhost/api/project?limit=1&offset=1'
      );

      const response = await app.fetch(request, env);
      const data = (await response.json()) as
        | ProjectListResponse
        | ErrorResponse;

      expect(response.status).toBe(200);
      if ('success' in data && data.success) {
        expect(data.projects).toHaveLength(1);
      }
      expect(statement.bind).toHaveBeenCalledWith(1, 1);
    });

    it('should return 500 on database error', async () => {
      statement.all.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const app = createRouter();
      const request = new Request('http://localhost/api/project');

      const response = await app.fetch(request, env);
      const data = (await response.json()) as SuccessResponse | ErrorResponse;

      expect(response.status).toBe(500);
      if ('error' in data) {
        expect(data.error).toBe('Internal Server Error');
        expect(data.message).toBe('Database connection failed');
      }
    });
  });

  describe('GET /api/project/:id', () => {
    it('should get project by ID', async () => {
      statement.first.mockResolvedValueOnce({
        id: 'testproj',
        description: 'Test Project',
        created_at: Date.now(),
        last_used: null,
      });

      const app = createRouter();
      const request = new Request('http://localhost/api/project/testproj');

      const response = await app.fetch(request, env);
      const data = (await response.json()) as
        | ProjectCreateResponse
        | ErrorResponse;

      expect(response.status).toBe(200);
      if ('success' in data && data.success) {
        expect(data.success).toBe(true);
        expect(data.project.id).toBe('testproj');
        expect(data.project.description).toBe('Test Project');
      }
    });

    it('should return 404 for non-existent project', async () => {
      statement.first.mockResolvedValueOnce(null);

      const app = createRouter();
      const request = new Request('http://localhost/api/project/nonexistent');

      const response = await app.fetch(request, env);
      const data = (await response.json()) as SuccessResponse | ErrorResponse;

      expect(response.status).toBe(404);
      if ('error' in data) {
        expect(data.error).toBe('Not Found');
        expect(data.message).toContain('nonexistent');
      }
    });

    it('should return 500 on database error', async () => {
      statement.first.mockRejectedValueOnce(new Error('Database query failed'));

      const app = createRouter();
      const request = new Request('http://localhost/api/project/testproj');

      const response = await app.fetch(request, env);
      const data = (await response.json()) as SuccessResponse | ErrorResponse;

      expect(response.status).toBe(500);
      if ('error' in data) {
        expect(data.error).toBe('Internal Server Error');
        expect(data.message).toBe('Database query failed');
      }
    });
  });
});
