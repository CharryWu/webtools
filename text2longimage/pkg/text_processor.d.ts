/* tslint:disable */
/* eslint-disable */
/**
 * Check if a character is CJK (Chinese, Japanese, Korean)
 * This is a critical performance function called for every character
 */
export function is_cjk_char(c: string): boolean;
/**
 * Fast check if string contains any CJK characters
 * Optimized to return early on first match
 */
export function is_cjk(text: string): boolean;
/**
 * Get character width for text justification
 * ASCII chars = 1, CJK chars = 2
 */
export function get_char_width(c: string): number;
/**
 * High-performance CJK text justification
 * Processes character-by-character with optimized width calculations
 */
export function justify_text_cjk(text: string, max_chars_per_line: number): string;
/**
 * High-performance English text justification
 * Word-based wrapping with optimized string operations
 */
export function justify_text_english(text: string, max_chars_per_line: number): string;
/**
 * Main text justification function
 * Automatically detects CJK content and uses appropriate algorithm
 */
export function justify_text(text: string, max_chars_per_line: number): string;
/**
 * Batch process multiple text justification operations
 * Takes JSON string array, returns JSON string array
 */
export function batch_justify_text(texts_json: string, max_chars_per_line: number): string;
/**
 * Process text in chunks for large text handling
 * Reduces memory pressure and enables progress tracking
 */
export function process_text_chunks(text: string, max_chars_per_line: number, chunk_size: number): string;
/**
 * Calculate character count with CJK width consideration
 * Used for accurate text measurements
 */
export function calculate_text_width(text: string): number;
/**
 * Validate text input for processing
 * Returns error message if invalid, empty string if valid
 */
export function validate_text_input(text: string): string;
/**
 * Get text processing statistics
 * Returns JSON string with analysis data
 */
export function get_text_stats(text: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly is_cjk_char: (a: number) => number;
  readonly is_cjk: (a: number, b: number) => number;
  readonly get_char_width: (a: number) => number;
  readonly justify_text_cjk: (a: number, b: number, c: number) => [number, number];
  readonly justify_text_english: (a: number, b: number, c: number) => [number, number];
  readonly justify_text: (a: number, b: number, c: number) => [number, number];
  readonly batch_justify_text: (a: number, b: number, c: number) => [number, number, number, number];
  readonly process_text_chunks: (a: number, b: number, c: number, d: number) => [number, number];
  readonly calculate_text_width: (a: number, b: number) => number;
  readonly validate_text_input: (a: number, b: number) => [number, number];
  readonly get_text_stats: (a: number, b: number) => [number, number];
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
