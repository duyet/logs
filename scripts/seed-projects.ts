/**
 * Seed default projects into D1 database
 * Run with: wrangler d1 execute duyet-logs --local --command "$(npm run seed:projects --silent)"
 */

interface Project {
  id: string;
  description: string;
}

const DEFAULT_PROJECTS: Project[] = [
  {
    id: 'debug',
    description: 'Development and debugging project',
  },
  {
    id: 'duyet',
    description: 'duyet.net personal website analytics',
  },
  {
    id: 'blog',
    description: 'Blog analytics and metrics',
  },
  {
    id: 'prod',
    description: 'Production environment',
  },
  {
    id: 'staging',
    description: 'Staging environment',
  },
  {
    id: 'test',
    description: 'Testing and QA environment',
  },
];

/**
 * Generate SQL INSERT statements for default projects
 */
function generateSeedSQL(): string {
  const timestamp = Date.now();

  const inserts = DEFAULT_PROJECTS.map((project) => {
    const id = project.id.replace(/'/g, "''"); // Escape single quotes
    const description = project.description.replace(/'/g, "''");

    return `INSERT OR IGNORE INTO projects (id, description, created_at, last_used) VALUES ('${id}', '${description}', ${timestamp}, NULL);`;
  });

  return inserts.join('\n');
}

// Output SQL statements
console.log(generateSeedSQL());
