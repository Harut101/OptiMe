export const SAFETY_AGENT = Symbol('SAFETY_AGENT');
export const SAFETY_AGENT_CONFIG = Symbol('SAFETY_AGENT_CONFIG');

export interface SafetyAgentConfig {
  enabled: boolean;
  provider: 'mock' | 'openai';
}
