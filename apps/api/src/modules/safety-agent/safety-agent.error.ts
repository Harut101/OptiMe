export class SafetyAgentError extends Error {
  constructor(message: string, public readonly fallbackReason: string) {
    super(message);
    this.name = 'SafetyAgentError';
  }
}
