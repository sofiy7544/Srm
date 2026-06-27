// Lightweight first-party event helper used by landing pages.
// Mirrors browser Pixel events to our own endpoint for segmentation.
(function () {
  function anonId() {
    let id = localStorage.getItem("anon_id");
    if (!id) {
      id = "a_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("anon_id", id);
    }
    return id;
  }

  window.trackEvent = function (eventName, segment, extra) {
    extra = extra || {};
    // 1) Browser Pixel (loaded via <script> on the page)
    if (window.fbq) {
      window.fbq("track", eventName, extra);
    }
    // 2) First-party mirror for our own CRM segmentation
    fetch("/webhooks/pixel-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: eventName,
        segment: segment,
        anon_id: anonId(),
        source_url: window.location.href,
        value: extra.value || null,
        currency: extra.currency || "USD",
      }),
    }).catch(function () {});
  };
})();
