const ADMIN_PASSWORD_SESSION_KEY = 'healthdial-admin-password'

export const getAdminMonitorPassword = () => {
  if (typeof window === 'undefined') {
    return ''
  }
  return window.sessionStorage.getItem(ADMIN_PASSWORD_SESSION_KEY) || ''
}

export const setAdminMonitorPassword = (value: string) => {
  if (typeof window === 'undefined') {
    return
  }
  window.sessionStorage.setItem(ADMIN_PASSWORD_SESSION_KEY, value)
}

export const clearAdminMonitorPassword = () => {
  if (typeof window === 'undefined') {
    return
  }
  window.sessionStorage.removeItem(ADMIN_PASSWORD_SESSION_KEY)
}
