import { Hono } from 'hono';
import type {
  Env,
  ProjectCreateRequest,
  ProjectCreateResponse,
  ProjectListResponse,
  ErrorResponse,
} from '../types/index.js';
import {
  createProject,
  listProjects,
  getProject,
} from '../services/project.js';

/**
 * Create and configure projects API router
 */
export function createProjectsRouter(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  /**
   * POST /api/projects - Create a new project
   */
  app.post('/', async (c) => {
    try {
      const body = await c.req.json<ProjectCreateRequest>();

      // Validate request
      if (!body.description || typeof body.description !== 'string') {
        const error: ErrorResponse = {
          error: 'Bad Request',
          message: 'Missing or invalid description field',
          status: 400,
        };
        return c.json(error, 400);
      }

      if (body.description.trim().length === 0) {
        const error: ErrorResponse = {
          error: 'Bad Request',
          message: 'Description cannot be empty',
          status: 400,
        };
        return c.json(error, 400);
      }

      // Create project
      const project = await createProject(c.env.DB, body);

      const response: ProjectCreateResponse = {
        success: true,
        project,
      };

      return c.json(response, 201);
    } catch (err) {
      const error: ErrorResponse = {
        error: 'Bad Request',
        message: err instanceof Error ? err.message : 'Unknown error',
        status: 400,
      };
      return c.json(error, 400);
    }
  });

  /**
   * GET /api/projects - List all projects
   */
  app.get('/', async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '100');
      const offset = parseInt(c.req.query('offset') || '0');

      const projects = await listProjects(c.env.DB, limit, offset);

      const response: ProjectListResponse = {
        success: true,
        projects,
        total: projects.length,
      };

      return c.json(response);
    } catch (err) {
      const error: ErrorResponse = {
        error: 'Internal Server Error',
        message: err instanceof Error ? err.message : 'Unknown error',
        status: 500,
      };
      return c.json(error, 500);
    }
  });

  /**
   * GET /api/projects/:id - Get a specific project
   */
  app.get('/:id', async (c) => {
    try {
      const id = c.req.param('id');

      const project = await getProject(c.env.DB, id);

      if (!project) {
        const error: ErrorResponse = {
          error: 'Not Found',
          message: `Project '${id}' not found`,
          status: 404,
        };
        return c.json(error, 404);
      }

      return c.json({
        success: true,
        project,
      });
    } catch (err) {
      const error: ErrorResponse = {
        error: 'Internal Server Error',
        message: err instanceof Error ? err.message : 'Unknown error',
        status: 500,
      };
      return c.json(error, 500);
    }
  });

  return app;
}
