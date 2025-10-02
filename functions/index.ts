import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Serve index.html at root path
 */
export const onRequestGet: PagesFunction = () => {
  try {
    // Read the HTML file
    const htmlPath = join(process.cwd(), 'functions', 'index.html');
    const html = readFileSync(htmlPath, 'utf-8');

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    return new Response('Error loading page', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
};
