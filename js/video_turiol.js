/* Link the built-in help to the full tutorial page. */
(function () {
  'use strict';
  const help = document.createElement('section');
  help.className = 'tutorial-help';
  help.innerHTML = '<div><h2>Prefer a video walkthrough?</h2><p>Watch the full guide to building, testing and saving robot plans.</p></div><button type="button" class="btn" data-open-view="tutorial">Open Tutorial</button>';
  document.querySelector('#helpPanel').prepend(help);
})();
