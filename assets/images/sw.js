const CACHE_NAME = "wegrow-cache-v3";
const ASSETS_TO_CACHE = [
  "/",
  "/dashboard",
  "/app-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/logo.png",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Let network handle dynamic API requests and app navigation
  if (event.request.method !== "GET" || event.request.url.includes("/api/")) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// Web Push Notification Event Handler
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || "WeGrow AI Reminder";
    const options = {
      body: payload.body || "Task update notification",
      icon: payload.icon || "/logo.png",
      badge: payload.badge || "/app-icon.png",
      tag: payload.tag || "wegrow-reminder",
      data: payload.data || { url: "/today" },
      actions: payload.actions || [
        { action: "open_task", title: "Open Task" },
        { action: "mark_complete", title: "Mark Complete" },
        { action: "snooze", title: "Snooze 1h" },
      ],
      vibrate: [200, 100, 200],
      renotify: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    // If not JSON, treat as plain text
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification("WeGrow AI Task Reminder", {
        body: text,
        icon: "/logo.png",
        badge: "/app-icon.png",
      })
    );
  }
});

// Notification Click Event Handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const action = event.action;
  const notifData = event.notification.data || {};
  let targetUrl = notifData.url || "/today";

  if (action === "open_task" || !action) {
    targetUrl = "/today";
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
