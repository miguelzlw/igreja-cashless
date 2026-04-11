// Utilitários de som usando Web Audio API
// Gera tons sintéticos para feedback de sucesso e erro — sem arquivos externos

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export function playSuccessSound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Tom agudo ascendente — indica sucesso
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.setValueAtTime(659.25, now + 0.1); // E5
    osc1.frequency.setValueAtTime(783.99, now + 0.2); // G5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);
  } catch {
    // Audio não disponível — ignora silenciosamente
  }
}

export function playErrorSound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Tom grave descendente — indica erro
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "square";
    osc1.frequency.setValueAtTime(349.23, now); // F4
    osc1.frequency.setValueAtTime(261.63, now + 0.15); // C4
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // Segundo bipe curto
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "square";
    osc2.frequency.setValueAtTime(220, now + 0.2); // A3
    gain2.gain.setValueAtTime(0.15, now + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.2);
    osc2.stop(now + 0.5);
  } catch {
    // Audio não disponível — ignora silenciosamente
  }
}
