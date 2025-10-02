import type { Context } from 'hono';
import type { ErrorResponse } from '../types/index.js';

/**
 * Error type classification
 */
export enum ErrorType {
	BAD_REQUEST = 'Bad Request',
	CONFIGURATION_ERROR = 'Configuration Error',
	INTERNAL_SERVER_ERROR = 'Internal Server Error',
}

/**
 * Map error messages to error types and status codes
 */
export function classifyError(error: Error): {
	type: ErrorType;
	status: 400 | 500;
} {
	if (error.message.includes('Invalid data format')) {
		return { type: ErrorType.BAD_REQUEST, status: 400 };
	}

	if (error.message.includes('Dataset binding not found')) {
		return { type: ErrorType.CONFIGURATION_ERROR, status: 500 };
	}

	return { type: ErrorType.INTERNAL_SERVER_ERROR, status: 500 };
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
	error: Error
): ErrorResponse & { status: 400 | 500 } {
	const { type, status } = classifyError(error);

	return {
		error: type,
		message: error.message || 'Unknown error',
		status,
	};
}

/**
 * Global error handler for Hono onError
 */
export function handleError(err: Error, c: Context): Response {
	console.error(err);

	const errorResponse = createErrorResponse(err);
	return c.json(errorResponse, errorResponse.status);
}
