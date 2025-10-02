/**
 * Load configuration from package.json
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PackageConfig {
	config?: {
		endpoints?: {
			local?: string;
			production?: string;
		};
	};
}

/**
 * Load endpoints configuration from package.json
 */
export function loadEndpoints(): {
	local: string;
	production: string;
} {
	try {
		const packagePath = join(__dirname, '..', 'package.json');
		const packageJson = JSON.parse(
			readFileSync(packagePath, 'utf-8')
		) as PackageConfig;

		const local =
			packageJson.config?.endpoints?.local || 'http://localhost:8788';
		const production =
			packageJson.config?.endpoints?.production ||
			'https://duyet-logs.pages.dev';

		return { local, production };
	} catch (error) {
		// Fallback to defaults if package.json can't be read
		console.warn('Warning: Could not load endpoints from package.json');
		return {
			local: 'http://localhost:8788',
			production: 'https://duyet-logs.pages.dev',
		};
	}
}
