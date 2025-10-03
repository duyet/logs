/**
 * Seed default projects via API
 * Run with:
 *   npm run db:seed          # Local
 *   npm run db:seed:remote   # Production
 *
 * Endpoints are configured in package.json config.endpoints
 */

import { loadEndpoints } from './config';

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
 * Seed projects via API
 */
async function seedProjects(): Promise<void> {
  const endpoints = loadEndpoints();
  const isRemote = process.argv.includes('--remote');
  const endpoint =
    process.env.ENDPOINT || (isRemote ? endpoints.production : endpoints.local);

  console.log(`🌱 Seeding projects to ${endpoint}...\n`);

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const project of DEFAULT_PROJECTS) {
    try {
      const response = await fetch(`${endpoint}/api/project`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(project),
      });

      if (response.ok) {
        console.log(`✅ Created project: ${project.id}`);
        succeeded++;
      } else if (response.status === 400) {
        const errorData: { message?: string } = await response.json();
        // Check if it's a duplicate project error
        if (
          errorData.message?.includes('UNIQUE constraint failed') ||
          errorData.message?.includes('already exists')
        ) {
          console.log(`⏭️  Skipped (already exists): ${project.id}`);
          skipped++;
        } else {
          console.error(
            `❌ Failed to create ${project.id}: ${errorData.message ?? 'Unknown error'}`
          );
          failed++;
        }
      } else {
        console.error(
          `❌ Failed to create ${project.id}: HTTP ${response.status}`
        );
        failed++;
      }
    } catch (err) {
      console.error(
        `❌ Failed to create ${project.id}:`,
        err instanceof Error ? err.message : String(err)
      );
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Created: ${succeeded}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📝 Total: ${DEFAULT_PROJECTS.length}`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Run seed
seedProjects().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
