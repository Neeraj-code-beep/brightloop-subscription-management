import { useCallback, useEffect, useMemo, useState } from 'react'
import { STORAGE_KEYS } from '../constants/roles.js'
import { readStorage, writeStorage } from '../utils/storage.js'
import { ThemeContext } from './ThemeContext.js'

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() =>
    readStorage(STORAGE_KEYS.theme, 'light') === 'dark' ? 'dark' : 'light',
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    writeStorage(STORAGE_KEYS.theme, theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  const value = useMemo(
    () => ({ theme, isDark: theme === 'dark', setTheme, toggleTheme }),
    [theme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
