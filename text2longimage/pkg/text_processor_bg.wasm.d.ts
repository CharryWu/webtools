/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const is_cjk_char: (a: number) => number;
export const is_cjk: (a: number, b: number) => number;
export const get_char_width: (a: number) => number;
export const justify_text_cjk: (a: number, b: number, c: number) => [number, number];
export const justify_text_english: (a: number, b: number, c: number) => [number, number];
export const justify_text: (a: number, b: number, c: number) => [number, number];
export const batch_justify_text: (a: number, b: number, c: number) => [number, number, number, number];
export const process_text_chunks: (a: number, b: number, c: number, d: number) => [number, number];
export const calculate_text_width: (a: number, b: number) => number;
export const validate_text_input: (a: number, b: number) => [number, number];
export const get_text_stats: (a: number, b: number) => [number, number];
export const __wbindgen_export_0: WebAssembly.Table;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __externref_table_dealloc: (a: number) => void;
export const __wbindgen_start: () => void;
