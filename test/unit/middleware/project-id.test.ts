import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../../../src/types/index.js';
import {
  projectIdMiddleware,
  extractProjectId,
} from '../../../src/middleware/project-id.js';
import * as projectService from '../../../src/services/project.js';

// Mock D1 database
function createMockD1Database(): D1Database {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn(),
      all: vi.fn(),
    }),
  } as unknown as D1Database;
}

describe('extractProjectId', () => {
  it('should extract project_id from URL path parameter', async () => {
    const app = new Hono<{ Bindings: Env }>();

    app.get('/test/:project_id', (c) => {
      const projectId = extractProjectId(c);
      return c.json({ projectId });
    });

    const req = new Request('http://localhost/test/path123');

    const res = await app.request(req);
    const data = await res.json();
    expect(data.projectId).toBe('path123');
  });

  it('should extract project_id from X-Project-ID header', async () => {
    const app = new Hono<{ Bindings: Env }>();

    app.get('/test', (c) => {
      const projectId = extractProjectId(c);
      return c.json({ projectId });
    });

    const req = new Request('http://localhost/test', {
      headers: { 'X-Project-ID': 'header123' },
    });

    const res = await app.request(req);
    const data = await res.json();
    expect(data.projectId).toBe('header123');
  });

  it('should extract project_id from query parameter', async () => {
    const app = new Hono<{ Bindings: Env }>();

    app.get('/test', (c) => {
      const projectId = extractProjectId(c);
      return c.json({ projectId });
    });

    const req = new Request('http://localhost/test?project_id=query123');

    const res = await app.request(req);
    const data = await res.json();
    expect(data.projectId).toBe('query123');
  });

  it('should prioritize path param over header', async () => {
    const app = new Hono<{ Bindings: Env }>();

    app.get('/test/:project_id', (c) => {
      const projectId = extractProjectId(c);
      return c.json({ projectId });
    });

    const req = new Request('http://localhost/test/path123', {
      headers: { 'X-Project-ID': 'header123' },
    });

    const res = await app.request(req);
    const data = await res.json();
    expect(data.projectId).toBe('path123');
  });

  it('should prioritize path param over query parameter', async () => {
    const app = new Hono<{ Bindings: Env }>();

    app.get('/test/:project_id', (c) => {
      const projectId = extractProjectId(c);
      return c.json({ projectId });
    });

    const req = new Request(
      'http://localhost/test/path123?project_id=query123'
    );

    const res = await app.request(req);
    const data = await res.json();
    expect(data.projectId).toBe('path123');
  });

  it('should prioritize header over query parameter', async () => {
    const app = new Hono<{ Bindings: Env }>();

    app.get('/test', (c) => {
      const projectId = extractProjectId(c);
      return c.json({ projectId });
    });

    const req = new Request('http://localhost/test?project_id=query123', {
      headers: { 'X-Project-ID': 'header123' },
    });

    const res = await app.request(req);
    const data = await res.json();
    expect(data.projectId).toBe('header123');
  });

  it('should return null when no project_id provided', async () => {
    const app = new Hono<{ Bindings: Env }>();

    app.get('/test', (c) => {
      const projectId = extractProjectId(c);
      return c.json({ projectId });
    });

    const req = new Request('http://localhost/test');

    const res = await app.request(req);
    const data = await res.json();
    expect(data.projectId).toBeNull();
  });
});

describe('projectIdMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call next() when no project_id provided', async () => {
    const app = new Hono<{ Bindings: Env }>();
    const mockDB = createMockD1Database();

    app.use('*', projectIdMiddleware);
    app.get('/test', (c) => c.json({ status: 'ok' }));

    const req = new Request('http://localhost/test');
    const env = {
      DB: mockDB,
      CLAUDE_CODE_ANALYTICS: {} as never,
      GA_ANALYTICS: {} as never,
    };

    const res = await app.request(req, {}, env);
    const data = await res.json();

    expect(data).toEqual({ status: 'ok' });
  });

  it('should validate existing project_id and update last_used', async () => {
    const app = new Hono<{ Bindings: Env }>();
    const mockDB = createMockD1Database();

    // Mock projectExists to return true
    vi.spyOn(projectService, 'projectExists').mockResolvedValue(true);
    const updateLastUsedSpy = vi
      .spyOn(projectService, 'updateLastUsed')
      .mockResolvedValue();

    app.use('*', projectIdMiddleware);
    app.get('/test', (c) => {
      const projectId = c.get('project_id');
      return c.json({ projectId });
    });

    const req = new Request('http://localhost/test', {
      headers: { 'X-Project-ID': 'existing123' },
    });

    const env = {
      DB: mockDB,
      CLAUDE_CODE_ANALYTICS: {} as never,
      GA_ANALYTICS: {} as never,
    };

    const res = await app.request(req, {}, env);
    const data = await res.json();

    expect(data.projectId).toBe('existing123');
    expect(projectService.projectExists).toHaveBeenCalledWith(
      mockDB,
      'existing123'
    );

    // Wait for async updateLastUsed (it's fire-and-forget)
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(updateLastUsedSpy).toHaveBeenCalledWith(mockDB, 'existing123');
  });

  it('should auto-create when project_id not found', async () => {
    const app = new Hono<{ Bindings: Env }>();
    const mockDB = createMockD1Database();
    const consoleInfoSpy = vi
      .spyOn(console, 'info')
      .mockImplementation(() => {});

    // Mock projectExists to return false (project doesn't exist)
    vi.spyOn(projectService, 'projectExists').mockResolvedValue(false);
    const createProjectSpy = vi
      .spyOn(projectService, 'createProject')
      .mockResolvedValue({
        id: 'nonexistent',
        description: 'Auto-created from GET /test',
        created_at: Date.now(),
        last_used: null,
      });

    app.use('*', projectIdMiddleware);
    app.get('/test', (c) => {
      const projectId = c.get('project_id');
      return c.json({ projectId });
    });

    const req = new Request('http://localhost/test', {
      headers: { 'X-Project-ID': 'nonexistent' },
    });

    const env = {
      DB: mockDB,
      CLAUDE_CODE_ANALYTICS: {} as never,
      GA_ANALYTICS: {} as never,
    };

    const res = await app.request(req, {}, env);
    const data = await res.json();

    expect(data.projectId).toBe('nonexistent');
    expect(createProjectSpy).toHaveBeenCalledWith(mockDB, {
      id: 'nonexistent',
      description: 'Auto-created from GET /test',
    });
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "Auto-creating project 'nonexistent' (from GET /test)"
    );

    consoleInfoSpy.mockRestore();
  });

  it('should handle validation errors gracefully', async () => {
    const app = new Hono<{ Bindings: Env }>();
    const mockDB = createMockD1Database();
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Mock projectExists to throw error
    vi.spyOn(projectService, 'projectExists').mockRejectedValue(
      new Error('DB error')
    );

    app.use('*', projectIdMiddleware);
    app.get('/test', (c) => c.json({ status: 'ok' }));

    const req = new Request('http://localhost/test', {
      headers: { 'X-Project-ID': 'test123' },
    });

    const env = {
      DB: mockDB,
      CLAUDE_CODE_ANALYTICS: {} as never,
      GA_ANALYTICS: {} as never,
    };

    const res = await app.request(req, {}, env);
    const data = await res.json();

    // Should continue despite error
    expect(data).toEqual({ status: 'ok' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error in project_id middleware:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should extract project_id from query parameter', async () => {
    const app = new Hono<{ Bindings: Env }>();
    const mockDB = createMockD1Database();

    vi.spyOn(projectService, 'projectExists').mockResolvedValue(true);
    vi.spyOn(projectService, 'updateLastUsed').mockResolvedValue();

    app.use('*', projectIdMiddleware);
    app.get('/test', (c) => {
      const projectId = c.get('project_id');
      return c.json({ projectId });
    });

    const req = new Request('http://localhost/test?project_id=query456');

    const env = {
      DB: mockDB,
      CLAUDE_CODE_ANALYTICS: {} as never,
      GA_ANALYTICS: {} as never,
    };

    const res = await app.request(req, {}, env);
    const data = (await res.json()) as { projectId: string | null };

    expect(data.projectId).toBe('query456');
  });

  it('should handle updateLastUsed errors without blocking', async () => {
    const app = new Hono<{ Bindings: Env }>();
    const mockDB = createMockD1Database();
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    vi.spyOn(projectService, 'projectExists').mockResolvedValue(true);
    vi.spyOn(projectService, 'updateLastUsed').mockRejectedValue(
      new Error('Update failed')
    );

    app.use('*', projectIdMiddleware);
    app.get('/test', (c) => c.json({ status: 'ok' }));

    const req = new Request('http://localhost/test', {
      headers: { 'X-Project-ID': 'test789' },
    });

    const env = {
      DB: mockDB,
      CLAUDE_CODE_ANALYTICS: {} as never,
      GA_ANALYTICS: {} as never,
    };

    const res = await app.request(req, {}, env);
    const data = await res.json();

    // Should continue despite error
    expect(data).toEqual({ status: 'ok' });

    // Wait for async error
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('should auto-create project if it does not exist', async () => {
    const app = new Hono<{ Bindings: Env }>();
    const mockDB = createMockD1Database();
    const consoleInfoSpy = vi
      .spyOn(console, 'info')
      .mockImplementation(() => {});

    vi.spyOn(projectService, 'projectExists').mockResolvedValue(false);
    const createProjectSpy = vi
      .spyOn(projectService, 'createProject')
      .mockResolvedValue({
        id: 'newproject',
        description: 'Auto-created from GET /test',
        created_at: Date.now(),
        last_used: null,
      });

    app.use('*', projectIdMiddleware);
    app.get('/test', (c) => {
      const projectId = c.get('project_id');
      return c.json({ projectId });
    });

    const req = new Request('http://localhost/test', {
      headers: { 'X-Project-ID': 'newproject' },
    });

    const env = {
      DB: mockDB,
      CLAUDE_CODE_ANALYTICS: {} as never,
      GA_ANALYTICS: {} as never,
    };

    const res = await app.request(req, {}, env);
    const data = (await res.json()) as { projectId: string | null };

    expect(data.projectId).toBe('newproject');
    expect(createProjectSpy).toHaveBeenCalledWith(mockDB, {
      id: 'newproject',
      description: 'Auto-created from GET /test',
    });
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "Auto-creating project 'newproject' (from GET /test)"
    );

    consoleInfoSpy.mockRestore();
  });

  it('should not auto-create project with invalid ID format', async () => {
    const app = new Hono<{ Bindings: Env }>();
    const mockDB = createMockD1Database();
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    app.use('*', projectIdMiddleware);
    app.get('/test', (c) => {
      const projectId = c.get('project_id');
      return c.json({ projectId });
    });

    const req = new Request('http://localhost/test', {
      headers: { 'X-Project-ID': 'INVALID_ID!' },
    });

    const env = {
      DB: mockDB,
      CLAUDE_CODE_ANALYTICS: {} as never,
      GA_ANALYTICS: {} as never,
    };

    const res = await app.request(req, {}, env);
    const data = (await res.json()) as { projectId: string | null };

    expect(data.projectId).toBe('INVALID_ID!');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Invalid project ID format 'INVALID_ID!', skipping auto-creation"
    );

    consoleWarnSpy.mockRestore();
  });

  it('should handle auto-creation errors gracefully', async () => {
    const app = new Hono<{ Bindings: Env }>();
    const mockDB = createMockD1Database();
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    vi.spyOn(projectService, 'projectExists').mockResolvedValue(false);
    vi.spyOn(projectService, 'createProject').mockRejectedValue(
      new Error('DB error')
    );

    app.use('*', projectIdMiddleware);
    app.get('/test', (c) => c.json({ status: 'ok' }));

    const req = new Request('http://localhost/test', {
      headers: { 'X-Project-ID': 'failproject' },
    });

    const env = {
      DB: mockDB,
      CLAUDE_CODE_ANALYTICS: {} as never,
      GA_ANALYTICS: {} as never,
    };

    const res = await app.request(req, {}, env);
    const data = await res.json();

    // Should continue despite error
    expect(data).toEqual({ status: 'ok' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to auto-create project 'failproject':",
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should handle executionCtx.waitUntil when available', async () => {
    const mockDB = createMockD1Database();
    const app = new Hono<{ Bindings: Env }>();

    // Mock projectExists to return true
    vi.spyOn(projectService, 'projectExists').mockResolvedValueOnce(true);

    // Mock updateLastUsed
    const updateLastUsedSpy = vi
      .spyOn(projectService, 'updateLastUsed')
      .mockResolvedValueOnce();

    app.use('/test', projectIdMiddleware);
    app.get('/test', (c) => c.json({ status: 'ok' }));

    const req = new Request('http://localhost/test', {
      headers: { 'X-Project-ID': 'testproject' },
    });

    // Mock executionCtx with waitUntil
    const mockWaitUntil = vi.fn();
    const mockExecutionCtx = {
      waitUntil: mockWaitUntil,
      passThroughOnException: vi.fn(),
      props: {},
    } as unknown as ExecutionContext;

    const env = {
      DB: mockDB,
      CLAUDE_CODE_ANALYTICS: {} as never,
      GA_ANALYTICS: {} as never,
    };

    const res = await app.request(req, {}, env, mockExecutionCtx);
    const data = await res.json();

    expect(data).toEqual({ status: 'ok' });
    expect(mockWaitUntil).toHaveBeenCalled();
    expect(updateLastUsedSpy).toHaveBeenCalledWith(mockDB, 'testproject');

    updateLastUsedSpy.mockRestore();
  });

  it('should handle missing executionCtx gracefully', async () => {
    const mockDB = createMockD1Database();
    const app = new Hono<{ Bindings: Env }>();

    // Mock projectExists to return true
    vi.spyOn(projectService, 'projectExists').mockResolvedValueOnce(true);

    // Mock updateLastUsed
    const updateLastUsedSpy = vi
      .spyOn(projectService, 'updateLastUsed')
      .mockResolvedValueOnce();

    app.use('/test', projectIdMiddleware);
    app.get('/test', (c) => c.json({ status: 'ok' }));

    const req = new Request('http://localhost/test', {
      headers: { 'X-Project-ID': 'testproject' },
    });

    const env = {
      DB: mockDB,
      CLAUDE_CODE_ANALYTICS: {} as never,
      GA_ANALYTICS: {} as never,
    };

    // No executionCtx provided
    const res = await app.request(req, {}, env);
    const data = await res.json();

    expect(data).toEqual({ status: 'ok' });
    expect(updateLastUsedSpy).toHaveBeenCalledWith(mockDB, 'testproject');

    updateLastUsedSpy.mockRestore();
  });
});
