use serde_json;
use wasm_bindgen::prelude::*;
use wee_alloc::WeeAlloc;

// Use `wee_alloc` as the global allocator. Reduces compiled .wasm size by 3KB
#[global_allocator]
static ALLOC: WeeAlloc = WeeAlloc::INIT;

// Bind console.log for debugging
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);

    #[wasm_bindgen(js_namespace = console, js_name = log)]
    fn log_u32(a: u32);
}

// Macro for console.log! debugging
macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

/// Check if a character is CJK (Chinese, Japanese, Korean)
/// This is a critical performance function called for every character
#[wasm_bindgen]
pub fn is_cjk_char(c: char) -> bool {
    let code_point = c as u32;

    // Han characters (Chinese): U+4E00-U+9FFF
    if code_point >= 0x4E00 && code_point <= 0x9FFF {
        return true;
    }

    // Hiragana: U+3040-U+309F
    if code_point >= 0x3040 && code_point <= 0x309F {
        return true;
    }

    // Katakana: U+30A0-U+30FF
    if code_point >= 0x30A0 && code_point <= 0x30FF {
        return true;
    }

    // Extended Han characters
    // CJK Extension A: U+3400-U+4DBF
    if code_point >= 0x3400 && code_point <= 0x4DBF {
        return true;
    }

    // CJK Extension B: U+20000-U+2A6DF
    if code_point >= 0x20000 && code_point <= 0x2A6DF {
        return true;
    }

    false
}

/// Fast check if string contains any CJK characters
/// Optimized to return early on first match
#[wasm_bindgen]
pub fn is_cjk(text: &str) -> bool {
    text.chars().any(is_cjk_char)
}

/// Get character width for text justification
/// ASCII chars = 1, CJK chars = 2
#[wasm_bindgen]
pub fn get_char_width(c: char) -> u32 {
    let code_point = c as u32;

    // ASCII range (0x00-0xFF) = width 1
    if code_point <= 0xFF {
        1
    } else {
        // Non-ASCII (including CJK) = width 2
        2
    }
}

/// High-performance CJK text justification
/// Processes character-by-character with optimized width calculations
#[wasm_bindgen]
pub fn justify_text_cjk(text: &str, max_chars_per_line: u32) -> String {
    let mut result = String::with_capacity(text.len() + text.len() / 20); // Pre-allocate with buffer
    let mut current_line_width = 0u32;

    for c in text.chars() {
        match c {
            '\r' | '\n' => {
                // Handle existing line breaks
                current_line_width = 0; // Reset width after line break
                if c == '\r' {
                    result.push_str("\r\n");
                } else {
                    result.push_str("\r\n");
                }
                continue;
            }
            _ => {
                let char_width = get_char_width(c);

                // Check if adding this character would exceed the line limit
                if current_line_width + char_width > max_chars_per_line {
                    result.push_str("\r\n");
                    current_line_width = char_width;
                } else {
                    current_line_width += char_width;
                }

                result.push(c);
            }
        }
    }

    result
}

/// High-performance English text justification
/// Word-based wrapping with optimized string operations
#[wasm_bindgen]
pub fn justify_text_english(text: &str, max_chars_per_line: u32) -> String {
    let words: Vec<&str> = text.split_whitespace().collect();
    let mut lines = Vec::with_capacity(words.len() / 8); // Estimate lines needed
    let mut current_line = String::with_capacity(max_chars_per_line as usize);

    for word in words {
        let word_len = word.len() as u32;
        let space_needed = if current_line.is_empty() { 0 } else { 1 }; // Space before word

        if current_line.len() as u32 + space_needed + word_len <= max_chars_per_line {
            // Word fits on current line
            if !current_line.is_empty() {
                current_line.push(' ');
            }
            current_line.push_str(word);
        } else {
            // Word doesn't fit, start new line
            if !current_line.is_empty() {
                lines.push(current_line);
                current_line = String::with_capacity(max_chars_per_line as usize);
            }
            current_line.push_str(word);
        }
    }

    // Add the last line if it has content
    if !current_line.is_empty() {
        lines.push(current_line);
    }

    lines.join("\r\n")
}

/// Main text justification function
/// Automatically detects CJK content and uses appropriate algorithm
#[wasm_bindgen]
pub fn justify_text(text: &str, max_chars_per_line: u32) -> String {
    let lines: Vec<&str> = text.split('\n').collect();
    let mut justified_lines = Vec::with_capacity(lines.len());

    for line in lines {
        let trimmed_line = line.trim();
        if trimmed_line.is_empty() {
            justified_lines.push(String::new());
            continue;
        }

        let justified_line = if is_cjk(trimmed_line) {
            justify_text_cjk(trimmed_line, max_chars_per_line)
        } else {
            justify_text_english(trimmed_line, max_chars_per_line)
        };

        justified_lines.push(justified_line);
    }

    justified_lines.join("\r\n")
}

/// Batch process multiple text justification operations
/// Takes JSON string array, returns JSON string array
#[wasm_bindgen]
pub fn batch_justify_text(texts_json: &str, max_chars_per_line: u32) -> Result<String, JsValue> {
    let text_array: Vec<String> = serde_json::from_str(texts_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid JSON: {}", e)))?;

    let results: Vec<String> = text_array
        .iter()
        .map(|text| justify_text(text, max_chars_per_line))
        .collect();

    serde_json::to_string(&results)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Process text in chunks for large text handling
/// Reduces memory pressure and enables progress tracking
#[wasm_bindgen]
pub fn process_text_chunks(text: &str, max_chars_per_line: u32, chunk_size: u32) -> String {
    let chunk_size = chunk_size as usize;
    let text_len = text.len();

    if text_len <= chunk_size {
        // Small text, process directly
        return justify_text(text, max_chars_per_line);
    }

    let mut result = String::with_capacity(text_len + text_len / 20);
    let mut start = 0;

    while start < text_len {
        let end = std::cmp::min(start + chunk_size, text_len);
        let chunk = &text[start..end];

        let justified_chunk = justify_text(chunk, max_chars_per_line);
        result.push_str(&justified_chunk);

        // Add separator between chunks if not at the end
        if end < text_len && !justified_chunk.ends_with("\r\n") {
            result.push_str("\r\n");
        }

        start = end;
    }

    result
}

/// Calculate character count with CJK width consideration
/// Used for accurate text measurements
#[wasm_bindgen]
pub fn calculate_text_width(text: &str) -> u32 {
    text.chars().map(get_char_width).sum()
}

/// Validate text input for processing
/// Returns error message if invalid, empty string if valid
#[wasm_bindgen]
pub fn validate_text_input(text: &str) -> String {
    if text.is_empty() {
        return "Text cannot be empty".to_string();
    }

    if text.len() > 500_000 {
        return "Text too large: maximum 500,000 characters supported".to_string();
    }

    String::new() // Empty string means valid
}

/// Get text processing statistics
/// Returns JSON string with analysis data
#[wasm_bindgen]
pub fn get_text_stats(text: &str) -> String {
    let char_count = text.chars().count();
    let byte_count = text.len();
    let line_count = text.lines().count();
    let cjk_count = text.chars().filter(|&c| is_cjk_char(c)).count();
    let ascii_count = text.chars().filter(|&c| (c as u32) <= 0xFF).count();
    let display_width = calculate_text_width(text);

    format!(
        r#"{{
            "charCount": {},
            "byteCount": {},
            "lineCount": {},
            "cjkCount": {},
            "asciiCount": {},
            "displayWidth": {},
            "hasCjk": {}
        }}"#,
        char_count,
        byte_count,
        line_count,
        cjk_count,
        ascii_count,
        display_width,
        is_cjk(text)
    )
}
