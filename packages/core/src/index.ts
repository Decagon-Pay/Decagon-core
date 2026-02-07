/**
 * @decagon/core
 * 
 * Effectful business logic core for Decagon.
 * This package contains pure Effect workflows that express all business logic
 * without direct side effects.
 */

// Re-export all capabilities
export * from "./capabilities/index.js";

// Re-export all workflows
export * from "./workflows/index.js";

// Re-export mock implementations
export * from "./mocks/index.js";
