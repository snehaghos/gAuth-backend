import axios from 'axios';

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const RECAPTCHA_VERIFY_TIMEOUT_MS = Number(process.env.RECAPTCHA_VERIFY_TIMEOUT_MS || 8000);

const isRecaptchaBypassEnabled = (): boolean => {
  const enabled = (process.env.SKIP_RECAPTCHA_IN_DEV || '').toLowerCase() === 'true';
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
  return enabled && nodeEnv !== 'production';
};

interface RecaptchaV3Response {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  error_codes?: string[];
  'error-codes'?: string[];
}

interface RecaptchaV2Response {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  error_codes?: string[];
  'error-codes'?: string[];
}

const getRecaptchaErrorCodes = (response: { error_codes?: string[]; 'error-codes'?: string[] }): string[] =>
  response.error_codes ?? response['error-codes'] ?? [];

const buildRecaptchaFailureMessage = (errorCodes: string[], version: 'v2' | 'v3'): string => {
  if (!errorCodes.length) {
    return `reCAPTCHA ${version} verification failed`;
  }

  if (errorCodes.includes('invalid-keys') || errorCodes.includes('invalid-input-secret')) {
    return `reCAPTCHA ${version} key configuration is invalid (${errorCodes.join(', ')})`;
  }

  return `reCAPTCHA ${version} verification failed: ${errorCodes.join(', ')}`;
};

/**
 * Verify reCAPTCHA v2 token (Checkbox or Invisible)
 * @param token - The reCAPTCHA v2 token from frontend
 * @returns Object with success status
 */
export const verifyRecaptchaV2 = async (
  token: string
): Promise<{ isValid: boolean; message: string; challengeTs?: string; hostname?: string }> => {
  try {
    const RECAPTCHA_SECRET_KEY_V2 = process.env.RECAPTCHA_SECRET_KEY_V2 || '';
    
    if (!RECAPTCHA_SECRET_KEY_V2) {
      process.stdout.write('missing v2 secret key in .env\n');
      return {
        isValid: false,
        message: 'reCAPTCHA v2 secret key not configured',
      };
    }

    if (!token || token === 'not available') {
      if (isRecaptchaBypassEnabled()) {
        process.stdout.write('bypassing v2 recaptcha in dev\n');
        return {
          isValid: true,
          message: 'reCAPTCHA v2 bypassed in dev',
        };
      }

      process.stdout.write('no v2 token provided\n');
      return {
        isValid: false,
        message: 'reCAPTCHA v2 token is required',
      };
    }

    process.stdout.write('verifying v2 token with google...\n');
    const response = await axios.post<RecaptchaV2Response>(
      RECAPTCHA_VERIFY_URL,
      null,
      {
        timeout: RECAPTCHA_VERIFY_TIMEOUT_MS,
        params: {
          secret: RECAPTCHA_SECRET_KEY_V2,
          response: token,
        },
      }
    );

    const { success, challenge_ts, hostname } = response.data;
    const errorCodes = getRecaptchaErrorCodes(response.data);

    if (!success) {
      process.stdout.write('v2 verification failed: ' + (errorCodes.join(', ') || 'unknown error') + '\n');
      return {
        isValid: false,
        message: buildRecaptchaFailureMessage(errorCodes, 'v2'),
      };
    }

    process.stdout.write('v2 token verified\n');
    return {
      isValid: true,
      message: 'reCAPTCHA v2 verification successful',
      ...(challenge_ts && { challengeTs: challenge_ts }),
      ...(hostname && { hostname }),
    };
  } catch (error) {
    const isTimeout = axios.isAxiosError(error) && error.code === 'ECONNABORTED';
    process.stdout.write('v2 api error: ' + (isTimeout ? 'timeout' : 'network issue') + '\n');
    return {
      isValid: false,
      message: isTimeout
        ? `reCAPTCHA v2 verification timed out after ${RECAPTCHA_VERIFY_TIMEOUT_MS}ms`
        : 'Failed to verify reCAPTCHA v2 token',
    };
  }
};

/**
 * Verify reCAPTCHA v3 token
 * @param token - The reCAPTCHA token from frontend
 * @param threshold - Minimum score (0.0-1.0) to pass verification (default: 0.5)
 * @returns Object with success status and score
 */
export const verifyRecaptcha = async (
  token: string,
  threshold: number = 0.5
): Promise<{ isValid: boolean; score: number; message: string }> => {
  try {
    // read env var at runtime so changes don't require restart
    const RECAPTCHA_SECRET_KEY_V3 =
      process.env.RECAPTCHA_SECRET_KEY_V3 || process.env.RECAPTCHA_SECRET_KEY || '';
    
    if (!RECAPTCHA_SECRET_KEY_V3) {
      process.stdout.write('missing v3 secret key\n');
      return {
        isValid: false,
        score: 0,
        message: 'reCAPTCHA secret key not configured',
      };
    }

    if (!token || token === 'not available') {
      if (isRecaptchaBypassEnabled()) {
        process.stdout.write('skipping v3 check in dev\n');
        return {
          isValid: true,
          score: 1,
          message: 'reCAPTCHA bypassed in dev',
        };
      }

      process.stdout.write('no v3 token\n');
      return {
        isValid: false,
        score: 0,
        message: 'reCAPTCHA token is required',
      };
    }

    process.stdout.write('checking v3 token...\n');
    const response = await axios.post<RecaptchaV3Response>(
      RECAPTCHA_VERIFY_URL,
      null,
      {
        timeout: RECAPTCHA_VERIFY_TIMEOUT_MS,
        params: {
          secret: RECAPTCHA_SECRET_KEY_V3,
          response: token,
        },
      }
    );

    const { success, score = 0, action } = response.data;
    const errorCodes = getRecaptchaErrorCodes(response.data);

    if (!success) {
      process.stdout.write('v3 failed: ' + (errorCodes.join(', ') || 'no details') + '\n');
      return {
        isValid: false,
        score: 0,
        message: buildRecaptchaFailureMessage(errorCodes, 'v3'),
      };
    }

    if (score < threshold) {
      process.stdout.write(`score ${score} below threshold ${threshold}\n`);
      return {
        isValid: false,
        score,
        message: `reCAPTCHA score ${score} is below threshold ${threshold}`,
      };
    }

    process.stdout.write('v3 looks good\n');
    return {
      isValid: true,
      score,
      message: 'reCAPTCHA verification successful',
    };
  } catch (error) {
    const isTimeout = axios.isAxiosError(error) && error.code === 'ECONNABORTED';
    process.stdout.write('v3 api issue: ' + (isTimeout ? 'timeout' : 'error') + '\n');
    return {
      isValid: false,
      score: 0,
      message: isTimeout
        ? `reCAPTCHA verification timed out after ${RECAPTCHA_VERIFY_TIMEOUT_MS}ms`
        : 'Failed to verify reCAPTCHA token',
    };
  }
};
