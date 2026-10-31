export function readStorage(key, fallback) {
  try {
    return window.localStorage.getItem(key) ?? fallback
  } catch (error) {
    console.warn(error)
    return fallback
  }
}

export function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch (error) {
    console.warn(error)
  }
}
