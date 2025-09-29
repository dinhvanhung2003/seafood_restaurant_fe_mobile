import { showMessage } from 'react-native-flash-message';

export const showSuccess = (msg: string) =>
  showMessage({ message: msg, type: 'success' });

export const showError = (msg: string) =>
  showMessage({ message: msg, type: 'danger' });

