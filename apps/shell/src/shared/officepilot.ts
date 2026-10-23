/**
 * OfficePilot modification of GenOffice (Apache-2.0): switches for features
 * that depend on Genspark services. This fork runs on the user's own model
 * keys only, so the Genspark account (device-code sign-in, credits, cloud
 * projects) and the Genspark model / search / media proxy are not offered.
 */
export const GENSPARK_ACCOUNT_ENABLED = false

/** Provider ids hidden from every picker in this fork. */
export const HIDDEN_PROVIDER_IDS: ReadonlySet<string> = new Set(['genspark'])
