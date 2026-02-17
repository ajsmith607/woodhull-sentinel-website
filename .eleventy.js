const path = require('path');
const fs = require('fs');

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = function(eleventyConfig) {

  // ---------------------------------------------------------------------------
  // Global data
  // ---------------------------------------------------------------------------

  eleventyConfig.addGlobalData('metadata', () => {
    return JSON.parse(fs.readFileSync('./src/issues-metadata.json', 'utf-8'));
  });

  // ---------------------------------------------------------------------------
  // Passthrough copies
  // ---------------------------------------------------------------------------

  // Site assets (CSS, JS)
  eleventyConfig.addPassthroughCopy({ 'src/assets': 'assets' });

  // Search index to site root
  eleventyConfig.addPassthroughCopy({ 'src/search-index.json': 'search-index.json' });

  // Vendor JS from node_modules
  eleventyConfig.addPassthroughCopy({
    'node_modules/flexsearch/dist/flexsearch.bundle.min.js': 'assets/js/vendor/flexsearch.bundle.min.js'
  });
  eleventyConfig.addPassthroughCopy({
    'node_modules/@panzoom/panzoom/dist/panzoom.min.js': 'assets/js/vendor/panzoom.min.js'
  });

  // ---------------------------------------------------------------------------
  // Custom filters
  // ---------------------------------------------------------------------------

  // Convert years object to array of [year, data] sorted descending
  eleventyConfig.addFilter('sortedYearsDesc', function(yearsObj) {
    return Object.entries(yearsObj).sort((a, b) => b[0].localeCompare(a[0]));
  });

  // Convert years object to array of [year, data] sorted ascending
  eleventyConfig.addFilter('sortedYearsAsc', function(yearsObj) {
    return Object.entries(yearsObj).sort((a, b) => a[0].localeCompare(b[0]));
  });

  // Prepend / to paths that don't start with / (for metadata paths like data/THUMBs/...)
  eleventyConfig.addFilter('rootRelative', function(urlPath) {
    if (!urlPath) return urlPath;
    return urlPath.startsWith('/') ? urlPath : '/' + urlPath;
  });

  // ---------------------------------------------------------------------------
  // Markdown: add id attributes to headings
  // ---------------------------------------------------------------------------

  eleventyConfig.amendLibrary('md', (mdLib) => {
    const defaultRender = mdLib.renderer.rules.heading_open ||
      function(tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };

    mdLib.renderer.rules.heading_open = function(tokens, idx, options, env, self) {
      const token = tokens[idx];
      const level = parseInt(token.tag.slice(1), 10);
      if (level >= 2 && level <= 6) {
        // Get the text content from the next inline token
        const contentToken = tokens[idx + 1];
        if (contentToken && contentToken.type === 'inline') {
          const text = contentToken.children
            .filter(t => t.type === 'text' || t.type === 'code_inline')
            .map(t => t.content)
            .join('');
          token.attrSet('id', slugify(text));
        }
      }
      return defaultRender(tokens, idx, options, env, self);
    };
  });

  // ---------------------------------------------------------------------------
  // Shortcode: table of contents
  // ---------------------------------------------------------------------------

  eleventyConfig.addAsyncShortcode('toc', async function(levels) {
    const allowedLevels = (levels || '2,3').split(',').map(n => parseInt(n.trim(), 10));
    const inputPath = this.page.inputPath;
    const source = fs.readFileSync(inputPath, 'utf-8');
    const headerRegex = /^(#{2,6})\s+(.+)$/gm;
    const items = [];
    let match;

    while ((match = headerRegex.exec(source)) !== null) {
      const level = match[1].length;
      if (!allowedLevels.includes(level)) continue;
      // Strip inline markdown: bold, italic, links, code
      const text = match[2]
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/_(.+?)_/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim();
      items.push({ level, text, id: slugify(text) });
    }

    if (items.length === 0) return '';

    const lis = items.map(item =>
      `  <li class="toc-h${item.level}"><a href="#${item.id}">${item.text}</a></li>`
    ).join('\n');

    return `<nav class="toc">\n<ul>\n${lis}\n</ul>\n</nav>`;
  });

  // ---------------------------------------------------------------------------
  // URL transform: convert root-relative paths to depth-correct relative paths
  // Enables file:// protocol support
  // ---------------------------------------------------------------------------

  eleventyConfig.htmlTransformer.addUrlTransform('html', function(urlInMarkup) {
    // Only transform root-relative paths (starting with single /)
    if (!urlInMarkup || !urlInMarkup.startsWith('/') || urlInMarkup.startsWith('//')) {
      return urlInMarkup;
    }

    // Determine the directory of the current page's output URL
    const pageUrl = this.url || '/';
    const fromDir = pageUrl.endsWith('/') ? pageUrl : path.posix.dirname(pageUrl) + '/';

    // Compute relative path from current page to target
    let relative = path.posix.relative(fromDir, urlInMarkup);
    if (!relative.startsWith('.')) {
      relative = './' + relative;
    }

    // Preserve trailing slash
    if (urlInMarkup.endsWith('/') && !relative.endsWith('/')) {
      relative += '/';
    }

    return relative;
  });

  // ---------------------------------------------------------------------------
  // Post-build: create data symlink in _site
  // ---------------------------------------------------------------------------

  eleventyConfig.on('eleventy.after', () => {
    const outputDir = path.join(__dirname, '_site');
    const symlinkPath = path.join(outputDir, 'data');
    const targetPath = path.join('..', 'data');

    if (!fs.existsSync(symlinkPath)) {
      fs.symlinkSync(targetPath, symlinkPath, 'dir');
      console.log('Created symlink: _site/data -> ../data');
    }
  });

  // ---------------------------------------------------------------------------
  // Eleventy directory config
  // ---------------------------------------------------------------------------

  return {
    dir: {
      input: 'src',
      output: '_site',
      includes: '_includes'
    },
    templateFormats: ['njk', 'html', 'md'],
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk'
  };
};
