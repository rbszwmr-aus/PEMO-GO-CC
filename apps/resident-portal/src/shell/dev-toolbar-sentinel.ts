/**
 * The needle the build-exclusion assertion looks for.
 *
 * It lives in its own plain-TypeScript module so the node test can import it
 * directly — Node's type stripping does not parse JSX, so importing it from the
 * .tsx component was not possible, and hard-coding the same string in the test
 * would mean two copies with nothing keeping them equal. That is the
 * duplication-without-a-check shape this project has a rule about.
 */
export const DEV_TOOLBAR_SENTINEL = 'PEMO_DEV_STATE_TOOLBAR_9d2b6e';
