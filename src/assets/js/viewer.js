(function() {
  'use strict';

  var img = document.getElementById('newspaper-image');
  if (!img) return;

  var container = document.getElementById('panzoom-container');
  var panzoom = Panzoom(img, {
    maxScale: 5,
    minScale: 0.3,
    step: 0.3,
    contain: 'outside'
  });

  var zoomIn = document.getElementById('zoom-in');
  var zoomOut = document.getElementById('zoom-out');
  var resetBtn = document.getElementById('reset-zoom');

  if (zoomIn) zoomIn.addEventListener('click', panzoom.zoomIn);
  if (zoomOut) zoomOut.addEventListener('click', panzoom.zoomOut);
  if (resetBtn) resetBtn.addEventListener('click', panzoom.reset);

  // Mouse wheel zoom on the container
  container.addEventListener('wheel', panzoom.zoomWithWheel);
})();
