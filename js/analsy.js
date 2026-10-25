/* Count published-app views only; never include strategy or user-entered data. */
(function (root) {
  'use strict';
  if (root.location.hostname !== 'digitrondragons-35816.github.io' ||
      !root.location.pathname.startsWith('/FTC-Dragonflow/')) return;

  var measurementId = 'G-453KWMWL4T';
  var page = 'https://digitrondragons-35816.github.io/FTC-Dragonflow/';
  var titles = {watch: 'Watch match', edit: 'Edit strategy', scores: 'Score details', help: 'How to play'};
  var previousView = null;
  root.dataLayer = root.dataLayer || [];
  root.gtag = function () { root.dataLayer.push(arguments); };
  root.gtag('js', new Date());
  root.gtag('config', measurementId, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: page,
    page_referrer: '',
    page_title: 'Dragonflow FTC BIOBUZZ strategy simulator'
  });

  root.BBAnalytics = {
    view: function (name) {
      if (!Object.prototype.hasOwnProperty.call(titles, name) || name === previousView) return;
      previousView = name;
      root.gtag('event', 'page_view', {
        send_to: measurementId,
        page_title: 'Dragonflow - ' + titles[name],
        page_location: page + '#' + name,
        page_referrer: ''
      });
    }
  };
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
  document.head.appendChild(script);
})(window);
