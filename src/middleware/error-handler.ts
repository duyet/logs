import type { Context, Next } from 'hono';
import type { ErrorResponse } from '../types/index.js';

/**
 * Global error handling middleware
 */
export async function errorHandler(c: Context, next: Next): Promise<void> {
  try {
    await next();
  } catch (error) {
    console.error(error);

    const errorResponse: ErrorResponse = {
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      status: 500,
    };

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Invalid data format')) {
        errorResponse.status = 400;
        errorResponse.error = 'Bad Request';
      } else if (error.message.includes('Dataset binding not found')) {
        errorResponse.status = 500;
        errorResponse.error = 'Configuration Error';
      }
    }

    c.status(errorResponse.status as 400 | 500);
    c.header('Content-Type', 'application/json');
    c.res = new Response(JSON.stringify(errorResponse), {
      status: errorResponse.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
