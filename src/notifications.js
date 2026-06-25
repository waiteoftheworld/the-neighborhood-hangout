import { getToken, onMessage } from 'firebase/messaging'
import { messaging } from './firebase'

const VAPID_KEY = 'BPIbCLFyUtAwvmlF0YxnzpUy0aMcaP92xZ0b-6GPwIYTs7lY_qOp4y24v5USMQDFT1vK01_3r7nJ5ujxyZX8qDA'

export async function enableNotifications() {
try {
const permission = await Notification.requestPermission()
if (permission !== 'granted') {
console.log('Notification permission not granted:', permission)
return null
}
const token = await getToken(messaging, { vapidKey: VAPID_KEY })
if (token) {
console.log('FCM registration token:', token)
return token
}
console.log('No registration token available.')
return null
} catch (err) {
console.error('Error enabling notifications:', err)
return null
}
}

export function listenForMessages(callback) {
return onMessage(messaging, (payload) => {
console.log('Foreground message received:', payload)
if (callback) callback(payload)
})
}
