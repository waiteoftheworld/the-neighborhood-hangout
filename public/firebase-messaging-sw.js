importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js')

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
const notificationTitle = payload.notification?.title || 'The Neighborhood Hangout'
const notificationOptions = {
body: payload.notification?.body || '',
icon: '/icon.png'
}
self.registration.showNotification(notificationTitle, notificationOptions)
})
