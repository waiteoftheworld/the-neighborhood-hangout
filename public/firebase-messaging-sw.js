importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "AIzaSyDWbtzXb2AlaS-Wjz7ytpZ8QrSkMm3NAl0",
  authDomain: "the-neighborhood-hangout.firebaseapp.com",
  projectId: "the-neighborhood-hangout",
  storageBucket: "the-neighborhood-hangout.firebasestorage.app",
  messagingSenderId: "937839699278",
  appId: "1:937839699278:web:a9226b75f2b3983fc32a1f",
  measurementId: "G-RJJFTCZXKN"
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {}
    self.registration.showNotification(d.title || 'The Neighborhood Hangout', {
      body: d.body || '',
      icon: '/icon.png',
      tag: d.tag || 'nh',
      data: { link: d.link || '/' },
    })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.link) || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus() }
      return clients.openWindow(link)
    })
    )
})
