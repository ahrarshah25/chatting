self.addEventListener("push", event => {
    if (!event?.data) return;
    const data = event.data.json();
    const title = data.title || 'New Message';
    const options = {
        body: data.message || 'You have a new message',
        icon: data.icon || '/chat.png',
        data: { url: data.url || '/chat' }
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
    event.notification.close();
    const url = event.notification?.data?.url || '/chat';
    event.waitUntil(clients.openWindow(url));
});
