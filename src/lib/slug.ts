import { customAlphabet } from "nanoid";

/**
 * Custom nanoid alphabet excluding look-alike characters:
 * no 0, O, o, 1, l, I.
 * Lowercase alphanumeric, 30 chars.
 */
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const SLUG_LENGTH = 8;

export const generateSlug = customAlphabet(ALPHABET, SLUG_LENGTH);
