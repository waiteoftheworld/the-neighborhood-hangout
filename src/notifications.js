import { getToken, onMessage, isSupported } from 'firebase/messaging'
import { messaging } from './firebase'

const VAPID_KEY = 'BPIbCLFyUtAwvmlF0YxnzpUy0aMcaP92xZ0b-6GPwIYTs7lY_qOp4y24v5USMQDFT1vK01_3r7nJ5ujxyZX8qDA'

export async function pushSupported() {
  try { return (await isSupported()) && 'Notification' in window } catch (e) { return false }
}

export async function enableNotifications() {
  try {
    if (!(await pushSupported())) return null
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    return (await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg })) || null
  } catch (err) {
    console.error('Error enabling notifications:', err)
    return null
  }
}

export function listenForMessages(callback) {
  return onMessage(messaging, (payload) => callback && callback(payload))
}
