import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics } from 'firebase/analytics'
import { getMessaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: "AIzaSyDWbtzXb2AlaS-Wjz7ytpZ8QrSkMm3NAl0",
  authDomain: "the-neighborhood-hangout.firebaseapp.com",
  projectId: "the-neighborhood-hangout",
  storageBucket: "the-neighborhood-hangout.firebasestorage.app",
  messagingSenderId: "937839699278",
  appId: "1:937839699278:web:a9226b75f2b3983fc32a1f",
  measurementId: "G-RJJFTCZXKN"
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const analytics = getAnalytics(app)
export const messaging = getMessaging(app)
