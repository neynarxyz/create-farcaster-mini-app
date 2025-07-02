/**
 * Application constants and configuration values.
 * 
 * This file contains all the configuration constants used throughout the mini app.
 * These values are either sourced from environment variables or hardcoded and provide
 * configuration for the app's appearance, behavior, and integration settings.
 * 
 * NOTE: This file is automatically updated by the init script.
 * Manual changes may be overwritten during project initialization.
 */

// --- App Configuration ---
/**
 * The base URL of the application.
 * Used for generating absolute URLs for assets and API endpoints.
 */
export const APP_URL = process.env.NEXT_PUBLIC_URL!;

/**
 * The name of the mini app as displayed to users.
 * Used in titles, headers, and app store listings.
 */
export const APP_NAME = 'Starter Kit';

/**
 * A brief description of the mini app's functionality.
 * Used in app store listings and metadata.
 */
export const APP_DESCRIPTION = 'A demo of the Neynar Starter Kit';

/**
 * The primary category for the mini app.
 * Used for app store categorization and discovery.
 */
export const APP_PRIMARY_CATEGORY = 'developer-tools';

/**
 * Tags associated with the mini app.
 * Used for search and discovery in app stores.
 */
export const APP_TAGS = ['neynar', 'starter-kit', 'demo'];

// --- Asset URLs ---
/**
 * URL for the app's icon image.
 * Used in app store listings and UI elements.
 */
export const APP_ICON_URL = `${APP_URL}/icon.png`;

/**
 * URL for the app's Open Graph image.
 * Used for social media sharing and previews.
 */
export const APP_OG_IMAGE_URL = `${APP_URL}/api/opengraph-image`;

/**
 * URL for the app's splash screen image.
 * Displayed during app loading.
 */
export const APP_SPLASH_URL = `${APP_URL}/splash.png`;

/**
 * Background color for the splash screen.
 * Used as fallback when splash image is loading.
 */
export const APP_SPLASH_BACKGROUND_COLOR = "#f7f7f7";

// --- UI Configuration ---
/**
 * Text displayed on the main action button.
 * Used for the primary call-to-action in the mini app.
 */
export const APP_BUTTON_TEXT = 'Launch NSK';

// --- Integration Configuration ---
/**
 * Webhook URL for receiving events from Neynar.
 * 
 * If Neynar API key and client ID are configured, uses the official
 * Neynar webhook endpoint. Otherwise, falls back to a local webhook
 * endpoint for development and testing.
 */
export const APP_WEBHOOK_URL = process.env.NEYNAR_API_KEY && process.env.NEYNAR_CLIENT_ID 
    ? `https://api.neynar.com/f/app/${process.env.NEYNAR_CLIENT_ID}/event`
    : `${APP_URL}/api/webhook`;

/**
 * Flag to enable/disable wallet functionality.
 * 
 * When true, wallet-related components and features are rendered.
 * When false, wallet functionality is completely hidden from the UI.
 * Useful for mini apps that don't require wallet integration.
 */
export const USE_WALLET = true;

/**
 * Flag to enable/disable analytics tracking.
 * 
 * When true, usage analytics are collected and sent to Neynar.
 * When false, analytics collection is disabled.
 * Useful for privacy-conscious users or development environments.
 */
export const ANALYTICS_ENABLED = true;
