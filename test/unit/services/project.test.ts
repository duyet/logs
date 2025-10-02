import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateProjectId,
  isValidProjectId,
  projectExists,
  createProject,
  getProject,
  listProjects,
  updateLastUsed,
} from '../../../src/services/project.js';
import type { ProjectCreateRequest } from '../../../src/types/index.js';

// Mock D1 database
function createMockD1Database(): {
  db: D1Database;
  statement: D1PreparedStatement;
  mockPrepare: ReturnType<typeof vi.fn>;
  mockBind: ReturnType<typeof vi.fn>;
  mockRun: ReturnType<typeof vi.fn>;
  mockFirst: ReturnType<typeof vi.fn>;
  mockAll: ReturnType<typeof vi.fn>;
} {
  const mockPrepare = vi.fn();
  const mockBind = vi.fn();
  const mockRun = vi.fn();
  const mockFirst = vi.fn();
  const mockAll = vi.fn();

  const db = {
    prepare: mockPrepare,
  } as unknown as D1Database;

  const statement = {
    bind: mockBind,
    run: mockRun,
    first: mockFirst,
    all: mockAll,
    raw: vi.fn(),
  } as unknown as D1PreparedStatement;

  mockPrepare.mockReturnValue(statement);
  mockBind.mockReturnValue(statement);

  return { db, statement, mockPrepare, mockBind, mockRun, mockFirst, mockAll };
}

describe('generateProjectId', () => {
  it('should generate an 8-character alphanumeric ID', () => {
    const id = generateProjectId();
    expect(id).toHaveLength(8);
    expect(id).toMatch(/^[a-z0-9]{8}$/);
  });

  it('should generate unique IDs', () => {
    const id1 = generateProjectId();
    const id2 = generateProjectId();
    const id3 = generateProjectId();

    // With 36^8 combinations, collisions are astronomically unlikely
    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });
});

describe('isValidProjectId', () => {
  it('should accept valid lowercase alphanumeric IDs', () => {
    expect(isValidProjectId('abc123')).toBe(true);
    expect(isValidProjectId('test')).toBe(true);
    expect(isValidProjectId('a1b2c3d4')).toBe(true);
  });

  it('should reject IDs that are too short', () => {
    expect(isValidProjectId('ab')).toBe(false);
    expect(isValidProjectId('a')).toBe(false);
    expect(isValidProjectId('')).toBe(false);
  });

  it('should reject IDs that are too long', () => {
    expect(isValidProjectId('a'.repeat(33))).toBe(false);
    expect(isValidProjectId('a'.repeat(100))).toBe(false);
  });

  it('should reject IDs with uppercase letters', () => {
    expect(isValidProjectId('ABC123')).toBe(false);
    expect(isValidProjectId('Test')).toBe(false);
  });

  it('should reject IDs with special characters', () => {
    expect(isValidProjectId('test-123')).toBe(false);
    expect(isValidProjectId('test_123')).toBe(false);
    expect(isValidProjectId('test.123')).toBe(false);
    expect(isValidProjectId('test 123')).toBe(false);
    expect(isValidProjectId('test@123')).toBe(false);
  });

  it('should accept IDs at boundary lengths', () => {
    expect(isValidProjectId('abc')).toBe(true); // Minimum 3
    expect(isValidProjectId('a'.repeat(32))).toBe(true); // Maximum 32
  });
});

describe('projectExists', () => {
  it('should return true when project exists', async () => {
    const { db, mockFirst } = createMockD1Database();
    mockFirst.mockResolvedValue({ id: 'test123' });

    const exists = await projectExists(db, 'test123');
    expect(exists).toBe(true);
  });

  it('should return false when project does not exist', async () => {
    const { db, mockFirst } = createMockD1Database();
    mockFirst.mockResolvedValue(null);

    const exists = await projectExists(db, 'nonexistent');
    expect(exists).toBe(false);
  });

  it('should use correct SQL query', async () => {
    const { db, mockPrepare, mockBind } = createMockD1Database();

    await projectExists(db, 'test123');

    expect(mockPrepare).toHaveBeenCalledWith('SELECT id FROM projects WHERE id = ? LIMIT 1');
    expect(mockBind).toHaveBeenCalledWith('test123');
  });
});

describe('createProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create project with auto-generated ID', async () => {
    const { db, mockFirst, mockRun } = createMockD1Database();
    mockFirst.mockResolvedValue(null); // Project doesn't exist

    const request: ProjectCreateRequest = {
      description: 'Test Project',
    };

    const project = await createProject(db, request);

    expect(project.id).toMatch(/^[a-z0-9]{8}$/);
    expect(project.description).toBe('Test Project');
    expect(project.created_at).toBeGreaterThan(0);
    expect(project.last_used).toBeNull();
    expect(mockRun).toHaveBeenCalled();
  });

  it('should create project with custom ID', async () => {
    const { db, mockFirst, mockRun } = createMockD1Database();
    mockFirst.mockResolvedValue(null); // Project doesn't exist

    const request: ProjectCreateRequest = {
      id: 'custom123',
      description: 'Custom ID Project',
    };

    const project = await createProject(db, request);

    expect(project.id).toBe('custom123');
    expect(project.description).toBe('Custom ID Project');
    expect(mockRun).toHaveBeenCalled();
  });

  it('should throw error for invalid custom ID', async () => {
    const { db } = createMockD1Database();

    const request: ProjectCreateRequest = {
      id: 'INVALID-ID!',
      description: 'Invalid Project',
    };

    await expect(createProject(db, request)).rejects.toThrow('Invalid project ID format');
  });

  it('should throw error for duplicate ID', async () => {
    const { db, mockFirst } = createMockD1Database();
    mockFirst.mockResolvedValue({ id: 'existing' }); // Project exists

    const request: ProjectCreateRequest = {
      id: 'existing',
      description: 'Duplicate Project',
    };

    await expect(createProject(db, request)).rejects.toThrow("Project ID 'existing' already exists");
  });

  it('should use correct SQL INSERT statement', async () => {
    const { db, mockPrepare, mockBind, mockFirst } = createMockD1Database();
    mockFirst.mockResolvedValue(null);

    const request: ProjectCreateRequest = {
      id: 'test123',
      description: 'Test Project',
    };

    await createProject(db, request);

    // Check INSERT statement
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO projects')
    );
    expect(mockBind).toHaveBeenCalledWith('test123', 'Test Project', expect.any(Number));
  });
});

describe('getProject', () => {
  it('should return project when found', async () => {
    const { db, mockFirst } = createMockD1Database();
    const mockProject = {
      id: 'test123',
      description: 'Test Project',
      created_at: 1234567890,
      last_used: null,
    };
    mockFirst.mockResolvedValue(mockProject);

    const project = await getProject(db, 'test123');

    expect(project).toEqual(mockProject);
  });

  it('should return null when project not found', async () => {
    const { db, mockFirst } = createMockD1Database();
    mockFirst.mockResolvedValue(null);

    const project = await getProject(db, 'nonexistent');

    expect(project).toBeNull();
  });

  it('should use correct SQL SELECT statement', async () => {
    const { db, mockPrepare, mockBind } = createMockD1Database();

    await getProject(db, 'test123');

    expect(mockPrepare).toHaveBeenCalledWith(
      'SELECT id, description, created_at, last_used FROM projects WHERE id = ?'
    );
    expect(mockBind).toHaveBeenCalledWith('test123');
  });
});

describe('listProjects', () => {
  it('should return list of projects with default pagination', async () => {
    const { db, mockAll } = createMockD1Database();
    const mockProjects = [
      { id: 'proj1', description: 'Project 1', created_at: 3, last_used: null },
      { id: 'proj2', description: 'Project 2', created_at: 2, last_used: 1 },
      { id: 'proj3', description: 'Project 3', created_at: 1, last_used: null },
    ];
    mockAll.mockResolvedValue({ results: mockProjects });

    const projects = await listProjects(db);

    expect(projects).toEqual(mockProjects);
  });

  it('should return empty array when no projects', async () => {
    const { db, mockAll } = createMockD1Database();
    mockAll.mockResolvedValue({ results: null });

    const projects = await listProjects(db);

    expect(projects).toEqual([]);
  });

  it('should use custom pagination parameters', async () => {
    const { db, mockBind, mockAll } = createMockD1Database();
    mockAll.mockResolvedValue({ results: [] });

    await listProjects(db, 50, 10);

    expect(mockBind).toHaveBeenCalledWith(50, 10);
  });

  it('should use correct SQL with ORDER BY created_at DESC', async () => {
    const { db, mockPrepare, mockAll } = createMockD1Database();
    mockAll.mockResolvedValue({ results: [] });

    await listProjects(db);

    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY created_at DESC')
    );
  });
});

describe('updateLastUsed', () => {
  it('should update last_used timestamp', async () => {
    const { db, mockBind, mockRun } = createMockD1Database();
    const beforeTime = Date.now();

    await updateLastUsed(db, 'test123');

    const afterTime = Date.now();

    expect(mockBind).toHaveBeenCalledWith(
      expect.any(Number),
      'test123'
    );

    const timestamp = mockBind.mock.calls[0]?.[0] as number;
    expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
    expect(timestamp).toBeLessThanOrEqual(afterTime);
    expect(mockRun).toHaveBeenCalled();
  });

  it('should use correct SQL UPDATE statement', async () => {
    const { db, mockPrepare } = createMockD1Database();

    await updateLastUsed(db, 'test123');

    expect(mockPrepare).toHaveBeenCalledWith(
      'UPDATE projects SET last_used = ? WHERE id = ?'
    );
  });
});
