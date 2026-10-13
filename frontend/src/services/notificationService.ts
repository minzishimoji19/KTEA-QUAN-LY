import apiClient from './apiClient';

export interface RegisteredDevice {
  id: string;
  recipient: string;
  deviceName: string | null;
  createdAt: string;
  updatedAt: string;
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function getDeviceName(): string {
  const ua = navigator.userAgent;
  let browser = 'Trình duyệt';
  if (ua.includes('Edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome/')) browser = 'Google Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
  else if (ua.includes('Firefox/')) browser = 'Firefox';

  let os = 'Thiết bị';
  if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh/i.test(ua)) os = 'MacBook/Mac';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return `${browser} trên ${os}`;
}

export const notificationService = {
  /**
   * Check if Web Push is supported on this browser/environment
   */
  isPushSupported: (): boolean => {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  },

  /**
   * Get VAPID public key from backend
   */
  getVapidPublicKey: async (): Promise<string> => {
    const res = await apiClient.get<{ publicKey: string }>('/notifications/vapid-public-key');
    return res.publicKey;
  },

  /**
   * Register or retrieve the active Service Worker
   */
  registerServiceWorker: async (): Promise<ServiceWorkerRegistration> => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Trình duyệt không hỗ trợ Service Worker');
    }
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    await navigator.serviceWorker.ready;
    return registration;
  },

  /**
   * Get existing subscription on this browser if any
   */
  getExistingSubscription: async (): Promise<PushSubscription | null> => {
    if (!notificationService.isPushSupported()) return null;
    try {
      const registration = await navigator.serviceWorker.ready;
      return registration.pushManager.getSubscription();
    } catch {
      return null;
    }
  },

  /**
   * Request permission, generate push subscription, and send to backend
   */
  subscribeDevice: async (
    recipient: string,
    passkey: string,
    customDeviceName?: string
  ): Promise<any> => {
    if (!notificationService.isPushSupported()) {
      throw new Error('Trình duyệt hoặc thiết bị này không hỗ trợ Web Push Notification');
    }

    // 1. Request Notification Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Quyền nhận thông báo đã bị từ chối trong trình duyệt');
    }

    // 2. Fetch VAPID key
    const publicKey = await notificationService.getVapidPublicKey();
    const convertedKey = urlBase64ToUint8Array(publicKey);

    // 3. Register SW and subscribe PushManager
    const registration = await notificationService.registerServiceWorker();
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as unknown as BufferSource,
      });
    }

    const subJson = subscription.toJSON();
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      throw new Error('Không thể tạo Web Push subscription');
    }

    const deviceName = customDeviceName?.trim() || getDeviceName();

    // 4. Save to backend
    return apiClient.post('/notifications/subscribe', {
      recipient,
      subscription: {
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
        },
      },
      deviceName,
      userAgent: navigator.userAgent,
      passkey,
    });
  },

  /**
   * Unsubscribe current device
   */
  unsubscribeDevice: async (): Promise<void> => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await apiClient.post('/notifications/unsubscribe', { endpoint });
      }
    } catch (err) {
      console.warn('Unsubscribe error:', err);
    }
  },

  /**
   * List registered devices for a recipient
   */
  getSubscriptions: async (recipient: string, passkey: string): Promise<RegisteredDevice[]> => {
    return apiClient.post<RegisteredDevice[]>('/notifications/subscriptions', {
      recipient,
      passkey,
    });
  },

  /**
   * Send a test push notification to this caregiver
   */
  sendTestPush: async (recipient: string, passkey: string): Promise<any> => {
    return apiClient.post('/notifications/test', {
      recipient,
      passkey,
    });
  },
};

export default notificationService;
