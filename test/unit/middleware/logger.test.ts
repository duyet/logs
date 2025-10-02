import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { logger } from '../../../src/middleware/logger.js';

describe('logger middleware', () => {
	it('should log request details', async () => {
		const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		const app = new Hono();
		app.use('*', logger);
		app.get('/test', (c) => c.json({ ok: true }));

		await app.request('/test');

		expect(consoleLogSpy).toHaveBeenCalledWith(
			expect.stringMatching(/^GET \/test 200 \d+ms$/)
		);

		consoleLogSpy.mockRestore();
	});

	it('should log different HTTP methods', async () => {
		const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		const app = new Hono();
		app.use('*', logger);
		app.post('/create', (c) => c.json({ created: true }));

		await app.request('/create', { method: 'POST' });

		expect(consoleLogSpy).toHaveBeenCalledWith(
			expect.stringMatching(/^POST \/create 200 \d+ms$/)
		);

		consoleLogSpy.mockRestore();
	});

	it('should log error status codes', async () => {
		const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		const app = new Hono();
		app.use('*', logger);
		app.get('/error', (c) => c.json({ error: 'Not found' }, 404));

		await app.request('/error');

		expect(consoleLogSpy).toHaveBeenCalledWith(
			expect.stringMatching(/^GET \/error 404 \d+ms$/)
		);

		consoleLogSpy.mockRestore();
	});

	it('should measure response time', async () => {
		const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		const app = new Hono();
		app.use('*', logger);
		app.get('/slow', async (c) => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return c.json({ ok: true });
		});

		await app.request('/slow');

		const logCall = consoleLogSpy.mock.calls[0]?.[0] as string;
		const duration = parseInt(logCall.match(/(\d+)ms$/)?.[1] || '0');

		expect(duration).toBeGreaterThanOrEqual(10);

		consoleLogSpy.mockRestore();
	});

	it('should not interfere with response', async () => {
		const app = new Hono();
		app.use('*', logger);
		app.get('/data', (c) => c.json({ data: 'test' }));

		const res = await app.request('/data');
		const json = await res.json();

		expect(res.status).toBe(200);
		expect(json).toEqual({ data: 'test' });
	});
});
