// src/utils/notify.ts
import { showMessage } from 'react-native-flash-message';

export const notify = {
  success: (message: string, description?: string) =>
    showMessage({ message, description, type: 'success' }),
  error: (message: string, description?: string) =>
    showMessage({ message, description, type: 'danger' }),
  info: (message: string, description?: string) =>
    showMessage({ message, description, type: 'info' }),
  warn: (message: string, description?: string) =>
    showMessage({ message, description, type: 'warning' }),
};
