"use client";

import { useState } from "react";

import "./index.css";
import { Spinner } from "./spinner";

/**
 * Props for the CustomCaptchaComponent
 * @interface CustomCaptchaProps
 */
export interface CustomCaptchaProps {
    /** Whether the captcha is currently loading */
    loading: boolean;

    /** 
     * Function to refresh/generate a new captcha
     * @returns Promise resolving to captcha data containing background image, puzzle piece, and unique ID
     */
    refreshCaptcha: () => Promise<{
        background: string;
        puzzle: string;
        id: string;
    }>;

    /** 
     * Function to verify the captcha solution
     * @param id - The captcha ID
     * @param value - The slider position value as string
     * @returns Promise resolving to verification result
     */
    verifyCaptcha: (
        id: string,
        value: string,
    ) => Promise<{
        success?: boolean;
        error?: string;
    }>;
}

/**
 * A customizable sliding puzzle captcha component for React applications.
 * 
 * This component provides a user-friendly captcha verification system where users
 * slide a puzzle piece to the correct position on a background image.
 * 
 * @component
 * @example
 * ```tsx
 * import CaptchaComponent from 'custom-captcha/client';
 * 
 * function MyForm() {
 *   const [loading, setLoading] = useState(false);
 * 
 *   const handleRefresh = async () => {
 *     // Your implementation to fetch new captcha data
 *     return {
 *       background: 'data:image/jpeg;base64,...' or 'https://....',
 *       puzzle: 'data:image/jpeg;base64,...' or 'https://....',
 *       id: 'unique-captcha-id'
 *     };
 *   };
 * 
 *   const handleVerify = async (id: string, value: string) => {
 *     // Your implementation to verify the captcha
 *     return { success: true };
 *   };
 * 
 *   return (
 *     <CaptchaComponent
 *       loading={loading}
 *       refreshCaptcha={handleRefresh}
 *       verifyCaptcha={handleVerify}
 *     />
 *   );
 * }
 * ```
 * 
 * @param props - The component props
 * @returns JSX element representing the captcha component
 * 
 * @version 1.0.0
 * @author Murtaza Baanihali
 * @license MIT
 */
const CaptchaComponent = ({
    loading,
    refreshCaptcha,
    verifyCaptcha,
}: CustomCaptchaProps) => {
    /** Whether the captcha has been successfully verified */
    const [correct, setCorrect] = useState(false);

    /** Current captcha data including background, puzzle piece, and ID */
    const [captcha, setCaptcha] = useState<{
        background: string;
        puzzle: string;
        id: string;
    } | null>(null);

    /** Current position of the slider (0-250 pixels) */
    const [sliderValue, setSliderValue] = useState(0);

    /** Whether the captcha modal/container is currently open */
    const [captchaOpen, setCaptchaOpen] = useState(false);

    /** Current error message, if any */
    const [error, setError] = useState<string | null>(null);

    /**
     * Refreshes the captcha by generating new puzzle data
     * Resets all state values and fetches a new captcha
     */
    const _refreshCaptcha = async () => {
        setSliderValue(0);
        setError(null);
        setCorrect(false);
        const refreshed = await refreshCaptcha();
        setCaptcha(refreshed);
    };

    /**
     * Verifies the current captcha solution
     * Calls the provided verifyCaptcha function with current state
     */
    const verify = async () => {
        if (!captcha?.id) return;
        const res = await verifyCaptcha(captcha.id, sliderValue.toString());
        if (res.error) {
            setCorrect(false);
            setError(res.error);
            return;
        }

        if (res.success) {
            setCorrect(true);
            setCaptchaOpen(false);
            return;
        }
    };

    /**
     * Handles checkbox state changes
     * Opens/closes the captcha container and triggers refresh if needed
     * @param event - The checkbox change event
     */
    const handleCheckChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setCaptchaOpen(!!event.target.checked);
        if (!captcha?.id && !loading) {
            _refreshCaptcha();
        }
    };

    return (
        <div className="relative">
            <div className="flex space-x-2 items-center">
                <input
                    type={"checkbox"}
                    name="custom-captcha"
                    checked={correct}
                    required
                    onChange={handleCheckChange}
                />
                <label htmlFor="captcha" className="text-sm font-medium">
                    {correct ? "Verified!" : "Verify you're human"}
                </label>
            </div>
            <div
                className={
                    captchaOpen
                        ? "custom-captcha-container"
                        : "custom-captcha-hidden"
                }
            >
                {captcha && (
                    <div>
                        <div className="puzzle-container">
                            <img
                                src={captcha.background}
                                width={300}
                                height={200}
                                alt="Background"
                                className="puzzle-background"
                            />
                            <img
                                src={captcha.puzzle}
                                height={50}
                                width={50}
                                alt="Puzzle Piece"
                                className="puzzle-piece"
                                style={{
                                    transform: `translateX(${sliderValue}px)`,
                                }}
                            />
                        </div>
                        <div className="captcha-controls">
                            <input
                                type="range"
                                min="0"
                                max="250"
                                value={sliderValue}
                                onChange={(e) =>
                                    setSliderValue(Number(e.target.value))
                                }
                                className="captcha-slider"
                            />
                        </div>
                    </div>
                )}
                {loading && <Spinner />}
                <div className={`captcha-hint ${error ? "error" : ""}`}>
                    {error
                        ? error
                        : "Slide the puzzle piece to the correct position"}
                </div>
                <div className="captcha-buttons">
                    <button
                        onClick={_refreshCaptcha}
                        disabled={loading}
                        title="Refresh"
                        className="custom-button"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                            <path d="M16 16h5v5" />
                        </svg>
                    </button>
                    <button
                        onClick={verify}
                        disabled={loading || !captcha}
                        title="Verify"
                        className="custom-button verify-button"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M20 6 9 17l-5-5" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * Custom Captcha Component Package
 * 
 * A React component that provides sliding puzzle captcha functionality.
 * Perfect for form validation and bot prevention.
 *
 * You can import this component using:
 * `import CaptchaComponent from 'custom-captcha/client';`
 * 
 * @version 1.0.0
 * @author Murtaza Baanihali
 * @license MIT
 */
export default CaptchaComponent;