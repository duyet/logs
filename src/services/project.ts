import type { Project, ProjectCreateRequest } from '../types/index.js';

/**
 * Generate a random alphanumeric project ID (8 characters)
 */
export function generateProjectId(): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let id = '';
	for (let i = 0; i < 8; i++) {
		id += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return id;
}

/**
 * Validate project ID format
 * - Alphanumeric only
 * - 3-32 characters
 */
export function isValidProjectId(id: string): boolean {
	return /^[a-z0-9]{3,32}$/.test(id);
}

/**
 * Check if project exists in database
 */
export async function projectExists(
	db: D1Database,
	id: string
): Promise<boolean> {
	const result = await db
		.prepare('SELECT id FROM projects WHERE id = ? LIMIT 1')
		.bind(id)
		.first();
	return result !== null;
}

/**
 * Create a new project
 * @param db D1 database binding
 * @param request Project creation request with optional custom ID
 * @returns Created project
 * @throws Error if custom ID is invalid or already exists
 */
export async function createProject(
	db: D1Database,
	request: ProjectCreateRequest
): Promise<Project> {
	const id = request.id || generateProjectId();

	// Validate ID format
	if (!isValidProjectId(id)) {
		throw new Error(
			'Invalid project ID format. Must be 3-32 alphanumeric characters.'
		);
	}

	// Check if ID already exists
	const exists = await projectExists(db, id);
	if (exists) {
		throw new Error(`Project ID '${id}' already exists.`);
	}

	const created_at = Date.now();

	// Insert project
	await db
		.prepare(
			'INSERT INTO projects (id, description, created_at, last_used) VALUES (?, ?, ?, NULL)'
		)
		.bind(id, request.description, created_at)
		.run();

	return {
		id,
		description: request.description,
		created_at,
		last_used: null,
	};
}

/**
 * Get a project by ID
 * @param db D1 database binding
 * @param id Project ID
 * @returns Project or null if not found
 */
export async function getProject(
	db: D1Database,
	id: string
): Promise<Project | null> {
	const result = await db
		.prepare(
			'SELECT id, description, created_at, last_used FROM projects WHERE id = ?'
		)
		.bind(id)
		.first<Project>();

	return result || null;
}

/**
 * List all projects
 * @param db D1 database binding
 * @param limit Maximum number of projects to return (default: 100)
 * @param offset Number of projects to skip (default: 0)
 * @returns Array of projects sorted by created_at DESC
 */
export async function listProjects(
	db: D1Database,
	limit = 100,
	offset = 0
): Promise<Project[]> {
	const { results } = await db
		.prepare(
			'SELECT id, description, created_at, last_used FROM projects ORDER BY created_at DESC LIMIT ? OFFSET ?'
		)
		.bind(limit, offset)
		.all<Project>();

	return results || [];
}

/**
 * Update last_used timestamp for a project
 * @param db D1 database binding
 * @param id Project ID
 */
export async function updateLastUsed(
	db: D1Database,
	id: string
): Promise<void> {
	const now = Date.now();
	await db
		.prepare('UPDATE projects SET last_used = ? WHERE id = ?')
		.bind(now, id)
		.run();
}
