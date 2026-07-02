import { 
  playBarcodeSound, 
  playSuccessSound, 
  playWarningSound, 
  playDeleteSound, 
  playNotificationSound 
} from './alerts';

export const playScannerBeep = () => {
  playBarcodeSound();
};

export function triggerSound(type: 'beep' | 'success' | 'warning' | 'error' | 'delete' | 'notification' | 'click') {
  if (type === 'beep' || type === 'click') {
    playBarcodeSound();
  } else if (type === 'success') {
    playSuccessSound();
  } else if (type === 'error' || type === 'warning') {
    playWarningSound();
  } else if (type === 'delete') {
    playDeleteSound();
  } else if (type === 'notification') {
    playNotificationSound();
  }
}

export function playSound(type: 'beep' | 'success' | 'warning' | 'error' | 'delete' | 'notification' | 'click') {
  triggerSound(type);
}
