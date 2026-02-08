const path = require('path');
const fs = require('fs');

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

  // Prepend / to paths that don't start with / (for metadata paths like data/THUMBs/...)
  eleventyConfig.addFilter('rootRelative', function(urlPath) {
    if (!urlPath) return urlPath;
    return urlPath.startsWith('/') ? urlPath : '/' + urlPath;
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
    templateFormats: ['njk', 'html'],
    htmlTemplateEngine: 'njk'
  };
};
