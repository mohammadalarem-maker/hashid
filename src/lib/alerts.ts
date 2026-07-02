// Alert and notification sound helper using Web Audio API and device vibration
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Capacitor } from '@capacitor/core';

let hasUserInteracted = false;
if (typeof window !== 'undefined') {
  const handleInteraction = () => {
    hasUserInteracted = true;
    window.removeEventListener('click', handleInteraction);
    window.removeEventListener('touchstart', handleInteraction);
    window.removeEventListener('keydown', handleInteraction);
  };
  window.addEventListener('click', handleInteraction, { capture: true, passive: true });
  window.addEventListener('touchstart', handleInteraction, { capture: true, passive: true });
  window.addEventListener('keydown', handleInteraction, { capture: true, passive: true });
}

function shouldPlaySound(): boolean {
  if (!soundAlertsEnabled) return false;
  return true;
}

let audioCtx: AudioContext | null = null;
let soundAlertsEnabled = true;
try {
  soundAlertsEnabled = localStorage.getItem('sound_alerts_enabled') !== 'false';
} catch (e) {
  console.warn("Storage access not available in this environment:", e);
}

// Dynamic listener to global settings to sync the sound preference in real-time
try {
  onSnapshot(doc(db, 'settings', 'global'), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      if (data.soundAlertsEnabled !== undefined) {
        soundAlertsEnabled = !!data.soundAlertsEnabled;
        try {
          localStorage.setItem('sound_alerts_enabled', String(soundAlertsEnabled));
        } catch (e) {
          console.warn("Writing to storage was restricted:", e);
        }
      }
    }
  }, (err) => {
    console.warn("Could not load real-time sound settings in alerts.ts:", err);
  });
} catch (err) {
  console.warn("Error setting up sound settings listener:", err);
}

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Vibrate helper
export function vibrateDevice(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn('Vibration not supported or blocked:', e);
    }
  }
}

// Play custom audio file MP3 with a robust Web Audio fallback if it fails or doesn't exist
function playAudioFile(path: string, fallbackSynth: () => void) {
  try {
    if (!shouldPlaySound()) {
      return;
    }
    const audio = new Audio(path);
    audio.play().catch((err) => {
      console.warn(`Audio autoplay or file load failed for ${path}, falling back to built-in Web Audio synthesizer:`, err);
      try {
        fallbackSynth();
      } catch (synthErr) {
        console.warn('Fallback synthesizer failed:', synthErr);
      }
    });
  } catch (err) {
    console.warn(`Failed to instantiate Audio for ${path}, falling back to built-in Web Audio synthesizer:`, err);
    try {
      fallbackSynth();
    } catch (synthErr) {
      console.warn('Fallback synthesizer failed:', synthErr);
    }
  }
}

// Play Barcode Scanner beep (Ultra compact loud high beep + vibration)
// 1. عند قراءة الباركود بنجاح: تشغيل صوت الباركود (Beep) + تفعيل اهتزاز خفيف للهاتف لمدّة 100ms
export function playBarcodeSound() {
  if (!shouldPlaySound()) return;
  // Vibrate device with a nice firm click/pulse for exactly 100ms
  vibrateDevice(100);

  playAudioFile('/sounds/barcode.mp3', () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, ctx.currentTime); // High pitched scanner frequency

      gainNode.gain.setValueAtTime(0.8, ctx.currentTime); // High volume
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12); // Shorter duration

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (err) {
      console.error('Audio beep failed:', err);
    }
  });
}

// Play Success Save chime (E.g. bright melodic chords)
// 3. عند الحفظ بنجاح: تشغيل صوت تأكيدي (Success Sound)
export function playSuccessSound() {
  if (!shouldPlaySound()) return;
  // Quick affirmative vibration double pulse
  vibrateDevice([60, 40, 60]);

  playAudioFile('/sounds/success.mp3', () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Arpeggio
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        try {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();

          osc.type = 'triangle'; // Soft pleasant chord tone
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);

          gainNode.gain.setValueAtTime(0.4, now + idx * 0.08);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.3);

          osc.connect(gainNode);
          gainNode.connect(ctx.destination);

          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.3);
        } catch (noteErr) {
          console.warn('Note start failed:', noteErr);
        }
      });
    } catch (err) {
      console.error('Success chime failed:', err);
    }
  });
}

// Play Warning/Low-Stock Alarm (Alternating warning wave)
// 2. عند انخفاض كمية الصنف: تشغيل صوت تنبيهي (Warning) عند وصول الصنف للحد الأدنى
export function playWarningSound() {
  if (!shouldPlaySound()) return;
  // Intense warning vibration pulse
  vibrateDevice([200, 100, 200]);

  playAudioFile('/sounds/warning.mp3', () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Double alarm pulse
      [0, 0.25].forEach((delay) => {
        try {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();

          osc.type = 'sawtooth'; // Attention grabbing sawtooth wave
          osc.frequency.setValueAtTime(440, now + delay); // Warning A4 frequency
          osc.frequency.linearRampToValueAtTime(330, now + delay + 0.2); // Pitch sweep down

          gainNode.gain.setValueAtTime(0.5, now + delay);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.22);

          osc.connect(gainNode);
          gainNode.connect(ctx.destination);

          osc.start(now + delay);
          osc.stop(now + delay + 0.22);
        } catch (oscErr) {
          console.warn('Oscillator build failed:', oscErr);
        }
      });
    } catch (err) {
      console.error('Warning sound failed:', err);
    }
  });
}

// Play Delete sound (Deep sliding base response)
// 4. عند الحذف: تشغيل صوت تنبيهي (Delete Sound)
export function playDeleteSound() {
  if (!shouldPlaySound()) return;
  // Clear tactile vibration pulse
  vibrateDevice(150);

  playAudioFile('/sounds/delete.mp3', () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(250, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.35); // Pitch sweep down representing removal

      gainNode.gain.setValueAtTime(0.4, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (err) {
      console.error('Delete sound failed:', err);
    }
  });
}

// Play a light subtle notification sound (🔔 تنبيه صوتي خفيف)
export function playNotificationSound() {
  if (!shouldPlaySound()) return;
  // Tactile light vibration
  vibrateDevice(50);

  playAudioFile('/sounds/notification.mp3', () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Elegant high-pitched dual tone (ascending, warm sine wave)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      const gain2 = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.12); // A5

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.03); // E5
      osc2.frequency.exponentialRampToValueAtTime(987.77, now + 0.15); // B5

      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.12, now + 0.03);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

      gain2.gain.setValueAtTime(0, now + 0.03);
      gain2.gain.linearRampToValueAtTime(0.08, now + 0.06);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.20);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.18);

      osc2.start(now + 0.03);
      osc2.stop(now + 0.20);
    } catch (err) {
      console.error('Notification sound failed:', err);
    }
  });
}
