/**
 * The needle the build-exclusion assertion looks for.
 *
 * It lives in its own plain-TypeScript module so that the node test can import
 * it directly — Node's type stripping does not parse JSX, so importing it from
 * the `.tsx` component was not possible, and hard-coding the same string in the
 * test would have meant two copies with nothing keeping them equal. That is the
 * duplication-without-a-check shape this project already has a rule about.
 */
export const DEV_TOOLBAR_SENTINEL = 'PEMO_DEV_STATE_TOOLBAR_a41f7c';
