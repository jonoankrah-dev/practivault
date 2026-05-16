/**
 * Hermes Configuration
 * 
 * Central place to control how Hermes behaves.
 * You can later move these values to environment variables (.env).
 */

export const HERMES_CONFIG = {
  // === Core Settings ===
  enabled: true,                    // Master switch for Hermes
  useMock: false,                   // Real Grok calls enabled (loads key from env or xai-api-key.txt)

  // === Mock Settings (used while useMock = true) ===
  mockConfidence: 0.8,              // Default confidence score for mock responses

  // === Approval Settings ===
  requireApproval: true,            // If false, Hermes can auto-execute some actions (future)
  autoApproveLowRisk: false,        // Future: allow low-risk actions without asking

  // === Logging ===
  verboseLogging: true,             // Show detailed Hermes logs in the console

  // === Future Integration ===
  hermesAgentUrl: "http://localhost:8000",   // URL of your real Hermes Agent (Grok)
  hermesApiKey: "",                          // If your Hermes Agent needs authentication

  // === PAI Integration (Phase 2) ===
  paiEnabled: false,                // Will be turned on in Phase 2
  paiUrl: "http://localhost:9000",  // Placeholder for PAI connection
};