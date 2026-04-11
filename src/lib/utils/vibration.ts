// Utilitários de vibração usando Vibration API
// Patterns distintos para sucesso e erro

export function vibrateSuccess(): void {
  try {
    if ("vibrate" in navigator) {
      // Vibração curta — indica sucesso
      navigator.vibrate(100);
    }
  } catch {
    // Vibration API não disponível
  }
}

export function vibrateError(): void {
  try {
    if ("vibrate" in navigator) {
      // Vibração longa com pausa — indica erro
      navigator.vibrate([200, 100, 200]);
    }
  } catch {
    // Vibration API não disponível
  }
}

export function vibrateLight(): void {
  try {
    if ("vibrate" in navigator) {
      navigator.vibrate(30);
    }
  } catch {
    // Vibration API não disponível
  }
}
