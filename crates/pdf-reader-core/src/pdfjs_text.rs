use lopdf::Object;
use pdf_extract::decode_text_string;

/// Match pdf.js `stringToPDFString` for public PDF text strings:
/// - UTF-16BE BOM (`FE FF`): drop a trailing unpaired byte, then decode pairs
/// - UTF-8 BOM (`EF BB BF`): decode UTF-8
/// - otherwise PDFDocEncoding via lopdf `decode_text_string`
pub(crate) fn decode_pdfjs_text_string(value: &Object) -> Option<String> {
    let bytes = match value {
        Object::String(bytes, _) => bytes.as_slice(),
        _ => return decode_text_string(value).ok(),
    };
    if bytes.starts_with(&[0xFE, 0xFF]) {
        let mut payload = &bytes[2..];
        if payload.len() % 2 == 1 {
            payload = &payload[..payload.len() - 1];
        }
        let units: Vec<u16> = payload
            .chunks_exact(2)
            .map(|chunk| u16::from_be_bytes([chunk[0], chunk[1]]))
            .collect();
        return String::from_utf16(&units).ok();
    }
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        return String::from_utf8(bytes[3..].to_vec()).ok();
    }
    decode_text_string(value).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::StringFormat;

    #[test]
    fn odd_length_utf16_be_drops_trailing_byte() {
        let value = Object::String(
            vec![0xFE, 0xFF, 0x00, 0x42, 0x00, 0x6F, 0x62],
            StringFormat::Hexadecimal,
        );
        assert_eq!(decode_pdfjs_text_string(&value).as_deref(), Some("Bo"));
    }

    #[test]
    fn valid_utf16_be_and_utf8_bom() {
        let utf16 = Object::String(
            vec![0xFE, 0xFF, 0x00, 0x41, 0x00, 0x64, 0x00, 0x61],
            StringFormat::Hexadecimal,
        );
        let utf8 = Object::String(vec![0xEF, 0xBB, 0xBF, b'H', b'i'], StringFormat::Hexadecimal);
        assert_eq!(decode_pdfjs_text_string(&utf16).as_deref(), Some("Ada"));
        assert_eq!(decode_pdfjs_text_string(&utf8).as_deref(), Some("Hi"));
    }
}
