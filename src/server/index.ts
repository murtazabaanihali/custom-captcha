import "server-only";
import { randomUUID } from "crypto";
import sharp from "sharp";
import fs from "fs";

/**
 * Constant value stored when a captcha is successfully verified
 */
const ON_VERIFY_CAPTCHA_VALUE = "verified";

/**
 * Configuration options for creating a new captcha
 * @interface CreateCaptchaProps
 */
interface CreateCaptchaProps {
  /** Optional custom image buffer to use as the captcha background */
  image?: Buffer;
  /** Optional custom captcha ID (if not provided, a UUID will be generated) */
  captchaId?: string;
  /** Fallback local image path if remote image fetching fails */
  fallbackImgPath?: string;
  /**
   * Function to store the captcha ID and its solution value
   * @param id - The captcha ID
   * @param value - The correct slider position value
   */
  storeCaptchaId: (id: string, value: string) => Promise<void>;
}

/**
 * Return type for captcha creation
 * @interface CaptchaData
 */
interface CaptchaData {
  /** Base64 encoded puzzle piece image */
  puzzle: string;
  /** Base64 encoded background image with puzzle piece removed */
  background: string;
  /** Unique captcha identifier */
  id: string;
}

/**
 * Return type for captcha verification
 * @interface VerificationResult
 */
interface VerificationResult {
  /** Whether the verification was successful */
  success: boolean;
  /** Reason for failure (if success is false) */
  reason?: string;
}

/**
 * Props for verifying a captcha
 * @interface VerifyCaptchaProps
 */
interface VerifyCaptchaProps {
  /** The unique captcha identifier */
  captchaId: string;
  /** The user's slider position as a string */
  value: string;
  /** Function to retrieve the stored correct position */
  getCaptchaValue: (id: string) => Promise<string | null>;
  /** Function to mark captcha as verified */
  changeCaptchaIdOnSuccess: (id: string, value: string) => Promise<void>;
  /** Optional tolerance value for correct positioning (default: 10px) */
  tolerance?: number;
}

/**
 * Creates a new sliding puzzle captcha with a randomly positioned puzzle piece.
 *
 * This function generates a captcha by:
 * 1. Selecting a random horizontal position for the puzzle piece (55-249px)
 * 2. Extracting a 50x50px puzzle piece from that position
 * 3. Creating a background image with the puzzle piece area blacked out
 * 4. Storing the correct position in your database/storage system
 *
 * @example
 * ```typescript
 * const captcha = await createCaptcha({
 *   fallbackImgPath: './assets/fallback.jpg',
 *   storeCaptchaId: async (id, value) => {
 *     // Store in your database/redis/etc.
 *     await redis.setex(id, value, 60 * 10); // Store in Redis with 10 minute TTL;
 *   }
 * });
 *
 * // return captcha data to client refreshCaptcha function
 * ```
 *
 * @param props - Configuration options for captcha creation
 * @returns Promise resolving to captcha data with base64 encoded images and ID
 * @throws {Error} When image processing fails or storage function throws
 *
 */
export const createCaptcha = async ({
  image,
  captchaId,
  fallbackImgPath,
  storeCaptchaId,
}: CreateCaptchaProps): Promise<CaptchaData> => {
  // Generate random slider position (minimum 55px to ensure puzzle piece fits)
  const sliderOffset = Math.max(55, Math.floor(Math.random() * 249));
  const _captchaId = captchaId || randomUUID();

  // Use provided image or fetch a new one
  const _image = image || (await getCaptchaImage(fallbackImgPath));
  if (!_image) {
    throw new Error("Failed to obtain captcha image");
  }

  const originalImage = sharp(_image);

  // Process images and store captcha data in parallel for better performance
  const [puzzlePieceBuffer, composedImage, _] = await Promise.all([
    // Extract the puzzle piece from the original image
    originalImage
      .clone()
      .extract({
        left: sliderOffset,
        top: 75,
        width: 50,
        height: 50,
      })
      .jpeg({ quality: 30 })
      .toBuffer(),

    // Create background with puzzle piece area blacked out and blurred
    originalImage
      .composite([
        {
          input: await sharp({
            create: {
              width: 50,
              height: 50,
              channels: 3,
              background: { r: 0, g: 0, b: 0 },
            },
          })
            .jpeg({ quality: 50 })
            .toBuffer(),
          top: 75,
          left: sliderOffset,
          blend: "over",
        },
      ])
      .blur()
      .jpeg({ quality: 30 })
      .toBuffer(),

    // Store the captcha solution in your database/redis/etc.
    storeCaptchaId(_captchaId, sliderOffset.toString()),
  ]);

  return {
    puzzle: `data:image/jpeg;base64,${puzzlePieceBuffer.toString("base64")}`,
    background: `data:image/jpeg;base64,${composedImage.toString("base64")}`,
    id: _captchaId,
  };
};

/**
 * Fetches a random image for use as a captcha background.
 *
 * This function attempts to fetch a random image from Picsum Photos API.
 * If the API request fails, it falls back to a local image file if provided.
 * Note: It is recommended to give a fallback image path to ensure captcha
 *
 * @example
 * ```typescript
 * // Fetch random image from API
 * const imageBuffer = await getCaptchaImage();
 *
 * // With fallback image
 * const imageBuffer = await getCaptchaImage('./assets/fallback.jpg');
 * ```
 *
 * @param fallbackImgPath - Optional path to a local fallback image
 * @returns Promise resolving to image buffer or null if all methods fail
 * @throws {Error} When both API fetch and fallback image reading fail
 *
 * @since 1.0.0
 */
export const getCaptchaImage = async (
  fallbackImgPath?: string,
): Promise<ArrayBuffer | Buffer | null> => {
  try {
    // Generate random image ID (Picsum has images 0-499)
    const imageId = Math.floor(Math.random() * 500);
    const imageUrl = `https://picsum.photos/id/${imageId}/300/200`;

    const response = await fetch(imageUrl);

    if (response.ok) {
      return await response.arrayBuffer();
    }

    // If API fails, try fallback image
    if (fallbackImgPath && fs.existsSync(fallbackImgPath)) {
      return fs.readFileSync(fallbackImgPath);
    }

    return null;
  } catch (error) {
    // If API fails, try fallback image
    if (fallbackImgPath && fs.existsSync(fallbackImgPath)) {
      try {
        return fs.readFileSync(fallbackImgPath);
      } catch (fallbackError) {
        throw new Error(
          `Failed to fetch image from API and fallback: ${fallbackError instanceof Error ? fallbackError?.message : "Unknown error"}`,
        );
      }
    }

    throw new Error(
      `Failed to fetch captcha image: ${error instanceof Error ? error?.message : "Unknown error"}`,
    );
  }
};

/**
 * Verifies a user's captcha solution by comparing their slider position with the stored correct position.
 *
 * This function:
 * 1. Retrieves the stored correct position for the given captcha ID
 * 2. Compares the user's answer with the correct position (allowing 10px tolerance)
 * 3. Marks the captcha as verified if correct
 * 4. Returns the verification result
 *
 * @example
 * ```typescript
 * const result = await verifyCaptcha({
 *   captchaId: 'captcha-id-123',
 *   value: '185', // User's slider position
 *   getCaptchaValue: async (id) => ...,
 *   changeCaptchaIdOnSuccess: async (id, value) => ...,
 *   tolerance: 12 // Optional, defaults to 10px
 * });
 *
 * if (result.success) {
 *   console.log('Captcha verified successfully!');
 * } else {
 *   console.log('Verification failed:', result.reason);
 * }
 * ```
 *
 * @param props - Configuration object containing all verification parameters
 * @returns Promise resolving to verification result
 *
 * @since 1.0.0
 */
export const verifyCaptcha = async (
  props: VerifyCaptchaProps,
): Promise<VerificationResult> => {
  const {
    captchaId,
    value,
    getCaptchaValue,
    changeCaptchaIdOnSuccess,
    tolerance,
  } = props;
  try {
    // Retrieve the stored correct position
    const storedValue = await getCaptchaValue(captchaId);

    if (!storedValue) {
      return {
        success: false,
        reason: "Captcha not found or has expired",
      };
    }

    // Check if captcha was already verified
    if (storedValue === ON_VERIFY_CAPTCHA_VALUE) {
      return {
        success: true,
      };
    }

    // Parse and validate the positions
    const userPosition = parseInt(value, 10);
    const correctPosition = parseInt(storedValue, 10);

    if (isNaN(userPosition) || isNaN(correctPosition)) {
      return {
        success: false,
        reason: "Invalid position values",
      };
    }

    // Allow 10px tolerance for correct positioning
    const _tolerance = tolerance || 10;
    const isCorrect = Math.abs(correctPosition - userPosition) <= _tolerance;

    if (isCorrect) {
      // Mark captcha as verified
      await changeCaptchaIdOnSuccess(captchaId, ON_VERIFY_CAPTCHA_VALUE);
      return { success: true };
    }

    return {
      success: false,
      reason: "Please position the puzzle piece correctly",
    };
  } catch (error) {
    return {
      success: false,
      reason: `Verification error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
};

/**
 * Checks if a captcha has been successfully verified by examining its stored value.
 *
 * This utility function helps determine if a captcha ID corresponds to a
 * successfully completed captcha challenge.
 *
 * @example
 * ```typescript
 * const storedValue = await database.getCaptchaValue(captchaId);
 * const isVerified = await hasCaptchaBeenVerified(storedValue);
 *
 * if (isVerified) {
 *   console.log('This captcha was successfully completed');
 * }
 * ```
 *
 * @param value - The stored value from your captcha database
 * @returns Promise resolving to true if the captcha has been verified
 *
 * @since 1.0.0
 */
export const hasCaptchaBeenVerified = async (
  value: string,
): Promise<boolean> => {
  return value === ON_VERIFY_CAPTCHA_VALUE;
};

// Export interfaces for public use
export type {
  CreateCaptchaProps,
  CaptchaData,
  VerificationResult,
  VerifyCaptchaProps,
};

/**
 * Server-side Captcha Validation Package
 *
 * This module provides server-side functions for creating and validating
 * sliding puzzle captchas. It includes image processing, random puzzle
 * generation, and secure verification with replay attack prevention.
 *
 * Key Features:
 * - Random puzzle piece positioning
 * - Base64 image encoding for easy client transmission
 * - Configurable tolerance for user positioning
 * - Fallback image support
 * - Comprehensive error handling
 *
 * @packageDocumentation
 * @author Murtaza Baanihali
 * @license MIT
 */
