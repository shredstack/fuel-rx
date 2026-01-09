/**
 * Utility to fetch and extract recipe content from a URL
 * for use in party plan generation
 */

export interface FetchedRecipe {
  url: string;
  title: string | null;
  content: string;
  error?: string;
}

/**
 * Basic HTML to text conversion - strips tags and normalizes whitespace
 */
function htmlToText(html: string): string {
  return html
    // Remove script and style content entirely
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Convert common block elements to newlines
    .replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, '\n')
    .replace(/<(br|hr)[^>]*\/?>/gi, '\n')
    // Remove all remaining tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&#\d+;/g, '') // Remove other numeric entities
    // Normalize whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

/**
 * Extract the title from HTML
 */
function extractTitle(html: string): string | null {
  // Try <title> tag first
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  // Try og:title meta tag
  const ogMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (ogMatch) {
    return ogMatch[1].trim();
  }

  // Try first h1
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    return h1Match[1].trim();
  }

  return null;
}

/**
 * Try to extract structured recipe data (JSON-LD schema)
 */
function extractStructuredRecipe(html: string): string | null {
  // Look for JSON-LD recipe schema
  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1]);

      // Handle array of schemas
      const schemas = Array.isArray(data) ? data : [data];

      for (const schema of schemas) {
        if (schema['@type'] === 'Recipe' ||
            (schema['@graph'] && schema['@graph'].some((item: { '@type'?: string }) => item['@type'] === 'Recipe'))) {

          const recipe = schema['@type'] === 'Recipe'
            ? schema
            : schema['@graph'].find((item: { '@type'?: string }) => item['@type'] === 'Recipe');

          if (recipe) {
            // Build a nice text representation
            const parts: string[] = [];

            if (recipe.name) {
              parts.push(`Recipe: ${recipe.name}`);
            }

            if (recipe.description) {
              parts.push(`\nDescription: ${recipe.description}`);
            }

            if (recipe.recipeYield) {
              parts.push(`\nYield: ${recipe.recipeYield}`);
            }

            if (recipe.prepTime || recipe.cookTime || recipe.totalTime) {
              const times: string[] = [];
              if (recipe.prepTime) times.push(`Prep: ${recipe.prepTime.replace('PT', '').toLowerCase()}`);
              if (recipe.cookTime) times.push(`Cook: ${recipe.cookTime.replace('PT', '').toLowerCase()}`);
              if (recipe.totalTime) times.push(`Total: ${recipe.totalTime.replace('PT', '').toLowerCase()}`);
              parts.push(`\nTime: ${times.join(', ')}`);
            }

            if (recipe.recipeIngredient && Array.isArray(recipe.recipeIngredient)) {
              parts.push(`\n\nIngredients:\n${recipe.recipeIngredient.map((i: string) => `- ${i}`).join('\n')}`);
            }

            if (recipe.recipeInstructions) {
              const instructions = Array.isArray(recipe.recipeInstructions)
                ? recipe.recipeInstructions
                : [recipe.recipeInstructions];

              const instructionTexts = instructions.map((inst: string | { text?: string; '@type'?: string }, idx: number) => {
                if (typeof inst === 'string') return `${idx + 1}. ${inst}`;
                if (inst.text) return `${idx + 1}. ${inst.text}`;
                return null;
              }).filter(Boolean);

              if (instructionTexts.length > 0) {
                parts.push(`\n\nInstructions:\n${instructionTexts.join('\n')}`);
              }
            }

            if (parts.length > 0) {
              return parts.join('');
            }
          }
        }
      }
    } catch {
      // JSON parse failed, continue to next match
      continue;
    }
  }

  return null;
}

/**
 * Fetch a recipe URL and extract the content
 */
export async function fetchRecipeContent(url: string): Promise<FetchedRecipe> {
  try {
    // Validate URL
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        url,
        title: null,
        content: '',
        error: 'Invalid URL protocol. Only HTTP and HTTPS are supported.',
      };
    }

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FuelRx/1.0; Recipe Fetcher)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      // Timeout after 10 seconds
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return {
        url,
        title: null,
        content: '',
        error: `Failed to fetch URL: ${response.status} ${response.statusText}`,
      };
    }

    const html = await response.text();
    const title = extractTitle(html);

    // First, try to extract structured recipe data
    const structuredRecipe = extractStructuredRecipe(html);
    if (structuredRecipe) {
      return {
        url,
        title,
        content: structuredRecipe,
      };
    }

    // Fall back to converting the whole page to text
    // Limit to reasonable size (first 15000 chars after conversion)
    const textContent = htmlToText(html);
    const truncatedContent = textContent.length > 15000
      ? textContent.substring(0, 15000) + '\n\n[Content truncated...]'
      : textContent;

    return {
      url,
      title,
      content: truncatedContent,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Handle specific error types
    if (message.includes('timeout') || message.includes('aborted')) {
      return {
        url,
        title: null,
        content: '',
        error: 'Request timed out. The website took too long to respond.',
      };
    }

    return {
      url,
      title: null,
      content: '',
      error: `Failed to fetch recipe: ${message}`,
    };
  }
}
