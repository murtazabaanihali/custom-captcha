
// Main package exports
export { default as CaptchaComponent } from './client/index';
export type { CustomCaptchaProps } from './client/index';

// Re-export server functions for convenience
export {
  createCaptcha,
  verifyCaptcha,
  getCaptchaImage,
  hasCaptchaBeenVerified
} from './server/index';

export type {
  CreateCaptchaProps,
  CaptchaData,
  VerificationResult,
  VerifyCaptchaProps
} from './server/index';
