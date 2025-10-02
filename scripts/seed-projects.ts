/**
 * Seed default projects via API
 * Run with:
 *   npm run db:seed          # Local (http://localhost:8788)
 *   npm run db:seed:remote   # Production (https://duyet-logs.pages.dev)
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
 * Seed projects via API
 */
async function seedProjects(): Promise<void> {
	// Determine endpoint from environment or command line args
	const isRemote = process.argv.includes('--remote');
	const endpoint = isRemote
		? 'https://duyet-logs.pages.dev'
		: process.env.ENDPOINT || 'http://localhost:8788';

	console.log(`🌱 Seeding projects to ${endpoint}...\n`);

	let succeeded = 0;
	let failed = 0;
	let skipped = 0;

	for (const project of DEFAULT_PROJECTS) {
		try {
			const response = await fetch(`${endpoint}/api/projects`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(project),
			});

			if (response.ok) {
				const data = await response.json();
				console.log(`✅ Created project: ${project.id}`);
				succeeded++;
			} else if (response.status === 400) {
				const error = await response.json();
				// Check if it's a duplicate project error
				if (
					error.message?.includes('UNIQUE constraint failed') ||
					error.message?.includes('already exists')
				) {
					console.log(`⏭️  Skipped (already exists): ${project.id}`);
					skipped++;
				} else {
					console.error(`❌ Failed to create ${project.id}: ${error.message}`);
					failed++;
				}
			} else {
				console.error(
					`❌ Failed to create ${project.id}: HTTP ${response.status}`
				);
				failed++;
			}
		} catch (error) {
			console.error(
				`❌ Failed to create ${project.id}:`,
				error instanceof Error ? error.message : error
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
