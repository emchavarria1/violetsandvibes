import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import {
  APP_PREFERENCES_STORAGE_KEY,
  normalizeAppPreferences,
} from '@/lib/appPreferences'

const applyInitialUiPreferences = () => {
  if (typeof window === 'undefined') return

  const root = window.document.documentElement
  if (root.getAttribute('data-theme-preapplied') === '1') return

  root.classList.remove('light', 'dark')

  let hasDarkModePreference = false
  let darkMode = false

  try {
    const rawPrefs = window.localStorage.getItem(APP_PREFERENCES_STORAGE_KEY)
    const parsedPrefs = rawPrefs ? JSON.parse(rawPrefs) : {}
    const prefs = normalizeAppPreferences(parsedPrefs)

    darkMode = prefs.darkMode
    hasDarkModePreference = typeof parsedPrefs?.darkMode === 'boolean'

    root.classList.toggle('vv-reduced-motion', prefs.reducedMotion)
    root.classList.toggle('vv-high-contrast', prefs.highContrast)
    root.classList.toggle('vv-large-text', prefs.largeText)
    root.setAttribute('data-autoplay-videos', prefs.autoPlayVideos ? 'true' : 'false')
    root.setAttribute('data-sound-effects', prefs.soundEffects ? 'true' : 'false')
  } catch {
    // Fall through to theme key handling below
  }

  const savedTheme = window.localStorage.getItem('theme')
  let resolvedTheme: 'light' | 'dark'

  if (hasDarkModePreference) {
    resolvedTheme = darkMode ? 'dark' : 'light'
  } else if (savedTheme === 'dark' || savedTheme === 'light') {
    resolvedTheme = savedTheme
  } else {
    resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  root.classList.add(resolvedTheme)
  root.setAttribute('data-theme-preapplied', '1')
}

applyInitialUiPreferences()

const LEGACY_SERVICE_WORKER_CLEANUP_KEY = 'vv:legacy-sw-cleanup-v1'

const hasCompletedLegacyServiceWorkerCleanup = () => {
  try {
    return window.localStorage.getItem(LEGACY_SERVICE_WORKER_CLEANUP_KEY) === 'done'
  } catch {
    return false
  }
}

const markLegacyServiceWorkerCleanupComplete = () => {
  try {
    window.localStorage.setItem(LEGACY_SERVICE_WORKER_CLEANUP_KEY, 'done')
  } catch {
    // Ignore storage failures and try again on the next page load.
  }
}

const cleanupLegacyServiceWorkers = async () => {
  if (!('serviceWorker' in navigator)) return
  if (hasCompletedLegacyServiceWorkerCleanup()) return

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    if (registrations.length === 0) {
      markLegacyServiceWorkerCleanupComplete()
      return
    }

    await Promise.all(registrations.map((registration) => registration.unregister()))

    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }

    markLegacyServiceWorkerCleanupComplete()
  } catch (error) {
    console.error('Service worker cleanup failed:', error)
  }
}

createRoot(document.getElementById('root')!).render(<App />)
void cleanupLegacyServiceWorkers()
