/** Seuils d'alerte de la console. Modifiez ici, nulle part ailleurs. */
export const ALERTS = {
  /** Échecs d'envoi OTP sur 24 h au-delà duquel une alerte critique s'affiche. */
  otpFailuresPer24h: 5,
  /** Erreurs non résolues au-delà desquelles un avertissement s'affiche. */
  unresolvedErrorsWarning: 10,
} as const;
