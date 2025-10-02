/**
 * Hono context variable extensions
 * Extends Hono's context to include custom variables
 */

declare module 'hono' {
	interface ContextVariableMap {
		project_id: string;
	}
}

export {};
