(function() {
  'use strict';

  var statusEl = document.getElementById('search-status');
  var gridEl = document.getElementById('results-grid');
  var inputEl = document.getElementById('search-query');

  // Read query from URL
  var params = new URLSearchParams(window.location.search);
  var query = params.get('q');

  if (query && inputEl) {
    inputEl.value = query;
  }

  if (!query) return;

  // Search page is at /search/index.html, so site root is one level up
  var baseUrl = '../';

  statusEl.innerHTML = '<p>Loading search index...</p>';

  fetch(baseUrl + 'search-index.json')
    .then(function(response) {
      if (!response.ok) throw new Error('Failed to load search index');
      statusEl.innerHTML = '<p>Parsing search index...</p>';
      return response.json();
    })
    .then(function(data) {
      // Reconstruct FlexSearch index from exported data
      var index = new FlexSearch.Document(data.config);

      var keys = Object.keys(data.keys);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (data.keys[key] != null) {
          index.import(key, data.keys[key]);
        }
      }

      // Search with enriched results to get stored fields
      var results = index.search(query, { limit: 200, enrich: true });

      // FlexSearch Document search returns array per indexed field
      // Deduplicate across fields (content, newspaper)
      var seen = {};
      var docs = [];
      for (var f = 0; f < results.length; f++) {
        var fieldResults = results[f].result;
        for (var r = 0; r < fieldResults.length; r++) {
          var item = fieldResults[r];
          if (!seen[item.id]) {
            seen[item.id] = true;
            docs.push(item.doc);
          }
        }
      }

      if (docs.length === 0) {
        statusEl.innerHTML = '<p>No results found for "' +
          escapeHtml(query) + '".</p>';
        return;
      }

      statusEl.innerHTML = '<p>Found ' + docs.length +
        ' results for "' + escapeHtml(query) + '".</p>';

      var html = '';
      for (var d = 0; d < docs.length; d++) {
        var doc = docs[d];
        var thumbPath = baseUrl + 'data/THUMBs/' + doc.issueId + '/' + doc.filename + '.jpg';
        var pageUrl = baseUrl + 'pages/' + doc.filename + '/';

        html += '<article class="issue-card">' +
          '<a href="' + pageUrl + '">' +
          '<img src="' + thumbPath + '" alt="' + escapeHtml(doc.newspaper) +
          ' - ' + escapeHtml(doc.dateDisplay) + '" loading="lazy" width="200">' +
          '</a>' +
          '<h3><a href="' + pageUrl + '">' + escapeHtml(doc.newspaper) + '</a></h3>' +
          '<time>' + escapeHtml(doc.dateDisplay) + '</time>' +
          '<p>Page ' + doc.pageNumber + '</p>' +
          '</article>';
      }

      gridEl.innerHTML = html;
    })
    .catch(function(err) {
      statusEl.innerHTML = '<p>Error loading search: ' + escapeHtml(err.message) +
        '. Search requires an HTTP server.</p>';
      console.error('Search error:', err);
    });

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
