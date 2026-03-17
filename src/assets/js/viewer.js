(function() {
  'use strict';

  var panzoomEl = document.getElementById('panzoom-element');
  var img = document.getElementById('newspaper-image');
  if (!panzoomEl || !img) return;

  var container = document.getElementById('panzoom-container');
  var panzoom = Panzoom(panzoomEl, {
    maxScale: 5,
    minScale: 0.3,
    step: 0.3,
    contain: 'outside'
  });

  var zoomIn  = document.getElementById('zoom-in');
  var zoomOut = document.getElementById('zoom-out');
  var resetBtn = document.getElementById('reset-zoom');

  if (zoomIn)   zoomIn.addEventListener('click', panzoom.zoomIn);
  if (zoomOut)  zoomOut.addEventListener('click', panzoom.zoomOut);
  if (resetBtn) resetBtn.addEventListener('click', panzoom.reset);

  container.addEventListener('wheel', panzoom.zoomWithWheel);

  // Search term highlighting
  var params = new URLSearchParams(window.location.search);
  var query = params.get('q');
  if (!query) return;

  var issueId = panzoomEl.dataset.issueId;
  var pageId  = panzoomEl.dataset.pageId;
  if (!issueId || !pageId) return;

  fetch('../../data/word-coords/' + issueId + '/' + pageId + '.json')
    .then(function(res) {
      if (!res.ok) return null;
      return res.json();
    })
    .then(function(data) {
      if (!data || !data._size) return;

      var svg = document.getElementById('highlight-overlay');
      svg.setAttribute('viewBox', '0 0 ' + data._size[0] + ' ' + data._size[1]);

      var svgNS = 'http://www.w3.org/2000/svg';
      var tokens = query.toLowerCase()
        .split(/\s+/)
        .map(function(t) { return t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''); })
        .filter(Boolean);

      tokens.forEach(function(token) {
        var matches = data[token];
        if (!matches) return;
        matches.forEach(function(coords) {
          var rect = document.createElementNS(svgNS, 'rect');
          rect.setAttribute('x', coords[0]);
          rect.setAttribute('y', coords[1]);
          rect.setAttribute('width', coords[2]);
          rect.setAttribute('height', coords[3]);
          svg.appendChild(rect);
        });
      });
    })
    .catch(function() {}); // silently skip if no coords available
})();
