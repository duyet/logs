import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { errorHandler } from '../../../src/middleware/error-handler.js';

describe('errorHandler middleware', () => {
  it('should handle errors and return 500 by default', async () => {
    const app = new Hono();
    app.use('*', errorHandler);
    app.get('/error', () => {
      throw new Error('Test error');
    });

    const res = await app.request('/error');
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json).toEqual({
      error: 'Internal Server Error',
      message: 'Test error',
      status: 500,
    });
  });

  it('should return 400 for invalid data format errors', async () => {
    const app = new Hono();
    app.use('*', errorHandler);
    app.get('/invalid', () => {
      throw new Error('Invalid data format');
    });

    const res = await app.request('/invalid');
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toEqual({
      error: 'Bad Request',
      message: 'Invalid data format',
      status: 400,
    });
  });

  it('should return 500 for dataset binding errors', async () => {
    const app = new Hono();
    app.use('*', errorHandler);
    app.get('/binding', () => {
      throw new Error('Dataset binding not found: TEST');
    });

    const res = await app.request('/binding');
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json).toEqual({
      error: 'Configuration Error',
      message: 'Dataset binding not found: TEST',
      status: 500,
    });
  });

  it('should handle non-Error objects', async () => {
    const app = new Hono();
    app.use('*', errorHandler);
    app.get('/non-error', () => {
      throw 'String error';
    });

    const res = await app.request('/non-error');
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json).toEqual({
      error: 'Internal Server Error',
      message: 'Unknown error',
      status: 500,
    });
  });

  it('should log errors to console', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const app = new Hono();
    app.use('*', errorHandler);
    app.get('/log', () => {
      throw new Error('Logged error');
    });

    await app.request('/log');

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));

    consoleErrorSpy.mockRestore();
  });

  it('should not interfere with successful requests', async () => {
    const app = new Hono();
    app.use('*', errorHandler);
    app.get('/success', (c) => c.json({ success: true }));

    const res = await app.request('/success');
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true });
  });
});
