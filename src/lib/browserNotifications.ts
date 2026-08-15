/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Utility helper to manage HTML5 Desktop Browser Notifications (Web Notification API)
 * with robust state handling, permission management, local storage persistence,
 * and user testing controls.
 */

const STORAGE_KEY = "dg_browser_notifications_enabled";

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return "denied";
  return Notification.permission;
}

export function isNotificationsEnabled(): boolean {
  if (!isNotificationSupported()) return false;
  const stored = localStorage.getItem(STORAGE_KEY);
  // Default to true if permission is already granted and no explicit preference is stored
  if (stored === null) {
    return Notification.permission === "granted";
  }
  return stored === "true" && Notification.permission === "granted";
}

export function setNotificationsEnabledState(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

/**
 * Request notification permission from the browser.
 * Returns a promise resolving to the final permission state.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    return "denied";
  }

  // Check if browser allows requesting permission
  if (Notification.permission === "denied") {
    console.warn("Notifications are blocked by the user in this browser.");
    return "denied";
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsEnabledState(true);
    } else {
      setNotificationsEnabledState(false);
    }
    return permission;
  } catch (err) {
    // Fallback for older browsers supporting callbacks
    return new Promise((resolve) => {
      Notification.requestPermission((permission) => {
        if (permission === "granted") {
          setNotificationsEnabledState(true);
        } else {
          setNotificationsEnabledState(false);
        }
        resolve(permission);
      });
    });
  }
}

interface NotificationOptions {
  body?: string;
  icon?: string;
  tag?: string;
  badge?: string;
  silent?: boolean;
  requireInteraction?: boolean;
}

/**
 * Sends a real-time desktop notification to the user if enabled and granted.
 */
export function sendBrowserNotification(title: string, body: string, tag?: string): boolean {
  if (!isNotificationSupported()) return false;

  // Verify permissions and user settings
  if (!isNotificationsEnabled()) {
    // If not enabled or allowed, fall back to simple audio beep for background alert if tab active
    try {
      playBeepSound();
    } catch (e) {
      // Ignore audio error
    }
    return false;
  }

  try {
    // Sound fallback & custom vibration pattern for notifications
    playBeepSound();

    const options: NotificationOptions = {
      body,
      tag: tag || "dg-notification",
      icon: "/favicon.ico", // Standard app icon fallback
      badge: "/favicon.ico",
      requireInteraction: true, // Keep notification open until dismissed/clicked by user
      silent: false
    };

    // Create the native HTML5 browser notification
    const notification = new Notification(title, options);

    // Optional click focus handler to focus the browser tab
    notification.onclick = function (event) {
      event.preventDefault();
      window.focus();
      notification.close();
    };

    return true;
  } catch (err) {
    console.error("Failed to display browser notification:", err);
    return false;
  }
}

/**
 * Auditory backup fallback beep
 */
function playBeepSound() {
  if (typeof window === "undefined" || !window.AudioContext) return;
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15); // Short beep
  } catch (e) {
    // Web Audio blocked by browser autoplay policy
  }
}
