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
		const data = (await res.json()) as { projectId: string };
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
		const data = (await res.json()) as { projectId: string };
		expect(data.projectId).toBe('query123');
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
		const data = (await res.json()) as { projectId: string };
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
		const data = (await res.json()) as { projectId: string | null };
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
		const data = (await res.json()) as { projectId: string };

		expect(data.projectId).toBe('existing123');
		expect(projectService.projectExists).toHaveBeenCalledWith(
			mockDB,
			'existing123'
		);

		// Wait for async updateLastUsed (it's fire-and-forget)
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(updateLastUsedSpy).toHaveBeenCalledWith(mockDB, 'existing123');
	});

	it('should warn when project_id not found but continue', async () => {
		const app = new Hono<{ Bindings: Env }>();
		const mockDB = createMockD1Database();
		const consoleWarnSpy = vi
			.spyOn(console, 'warn')
			.mockImplementation(() => {});

		// Mock projectExists to return false
		vi.spyOn(projectService, 'projectExists').mockResolvedValue(false);

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
		const data = (await res.json()) as { projectId: string };

		expect(data.projectId).toBe('nonexistent');
		expect(consoleWarnSpy).toHaveBeenCalledWith(
			"Project ID 'nonexistent' not found in database"
		);

		consoleWarnSpy.mockRestore();
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
			'Error validating project_id:',
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
		const data = (await res.json()) as { projectId: string };

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
});
