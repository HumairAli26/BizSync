const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const ORG_CODE_REGEX = /^[A-Z0-9]{6}$/;
const NUMBER_REGEX = /^\d+(?:\.\d+)?$/;
const GOOGLE_EMAIL_REGEX = /^[^\s@]+@(gmail\.com|googlemail\.com)$/i;

export const validateEmail = (value: string) => EMAIL_REGEX.test(value.trim());

export const validateGoogleEmail = (value: string) =>
  validateEmail(value) && GOOGLE_EMAIL_REGEX.test(value.trim());

export const validatePassword = (value: string) => PASSWORD_REGEX.test(value);

export const validateOrgCode = (value: string) =>
  ORG_CODE_REGEX.test(value.trim().toUpperCase());

export const validateRequiredText = (value: string, minLength = 1) =>
  value.trim().length >= minLength;

export const validatePositiveInteger = (value: string) => {
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) && Number(trimmed) > 0;
};

export const validateNonNegativeNumber = (value: string) => {
  const trimmed = value.trim();
  return NUMBER_REGEX.test(trimmed) && Number(trimmed) >= 0;
};

export const validatePositiveNumber = (value: string) => {
  const trimmed = value.trim();
  return NUMBER_REGEX.test(trimmed) && Number(trimmed) > 0;
};

export const sanitizeEmail = (value: string) => value.trim().toLowerCase();
export const sanitizeOrgCode = (value: string) => value.trim().toUpperCase();
