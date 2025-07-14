export function setItem<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to save item:', error);
  }
}

export function getItem<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Failed to load item:', error);
    return null;
  }
}

export function removeItem(key: string) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('Failed to remove item:', error);
  }
}
