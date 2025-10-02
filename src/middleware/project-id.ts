import type { Context, Next } from 'hono';
import type { Env } from '../types/index.js';
import { projectExists, updateLastUsed } from '../services/project.js';

/**
 * Extract project_id from request
 * Priority: header > query > body
 */
export function extractProjectId(c: Context<{ Bindings: Env }>): string | null {
  // 1. Check X-Project-ID header
  const headerProjectId = c.req.header('X-Project-ID');
  if (headerProjectId) {
    return headerProjectId;
  }

  // 2. Check query parameter
  const queryProjectId = c.req.query('project_id');
  if (queryProjectId) {
    return queryProjectId;
  }

  // 3. Check body (for POST requests)
  try {
    const body = c.req.raw.clone();
    if (body.body && c.req.method === 'POST') {
      // Note: We can't await here in sync extraction, body will be parsed in route handler
      // This is just a placeholder - actual body extraction happens in route
      return null;
    }
  } catch {
    // Ignore body parsing errors
  }

  return null;
}

/**
 * Project ID middleware
 * Validates project_id and updates last_used timestamp
 * Non-blocking: warnings only, doesn't reject requests
 */
export async function projectIdMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
): Promise<void> {
  const projectId = extractProjectId(c);

  if (projectId) {
    // Attach project_id to context for adapters (before validation)
    c.set('project_id', projectId);

    // Validate project existence (non-blocking)
    try {
      const exists = await projectExists(c.env.DB, projectId);

      if (!exists) {
        console.warn(`Project ID '${projectId}' not found in database`);
      } else {
        // Update last_used asynchronously (fire and forget)
        const updatePromise = updateLastUsed(c.env.DB, projectId).catch((err) => {
          console.error(`Failed to update last_used for project '${projectId}':`, err);
        });

        // Use waitUntil if available (production), otherwise just fire and forget (tests)
        try {
          if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
            c.executionCtx.waitUntil(updatePromise);
          }
        } catch {
          // executionCtx not available (e.g., in tests) - promise will still execute
        }
      }
    } catch (err) {
      console.error('Error validating project_id:', err);
      // Continue anyway - non-blocking
    }
  }

  await next();
}
