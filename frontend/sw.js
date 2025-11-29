self.addEventListener("push", event => {
  try {
    if (!event || !event.data) {
      console.log('sw push: no event data');
      return;
    }
    const data = event.data.json();
    if (!data) {
      console.log('sw push: parsed data missing');
      return;
    }
    const title = data.title || 'New Message';
    const body = data.message || 'You have a new message';
    const icon = data.icon || '/chat.png';
    const url = data.url || '/chat';
    const opts = { body, icon, data: { url } };
    self.registration.showNotification(title, opts);
  } catch (err) {
    console.error('sw push handler error', err);
  }
});

self.addEventListener("notificationclick", event => {
  try {
    if (!event) {
      console.log('sw notificationclick: event missing');
      return;
    }
    event.notification.close();
    const url = (event.notification && event.notification.data && event.notification.data.url) ? event.notification.data.url : '/chat';
    event.waitUntil(
      clients.openWindow(url)
    );
  } catch (err) {
    console.error('sw notificationclick error', err);
  }
});
