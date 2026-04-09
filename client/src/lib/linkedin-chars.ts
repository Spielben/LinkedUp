/**
 * LinkedIn character counter — matches KONTENU's custom counting rules.
 * Emojis count as 2 characters, bold Unicode counts as 2, everything else is 1.
 */

function isEmoji(char: string): boolean {
  const code = char.codePointAt(0)!;
  return (
    (code >= 0x1f600 && code <= 0x1f64f) || // Emoticons
    (code >= 0x1f300 && code <= 0x1f5ff) || // Miscellaneous Symbols
    (code >= 0x1f680 && code <= 0x1f6ff) || // Transport and Map
    (code >= 0x1f1e0 && code <= 0x1f1ff) || // Regional Indicator
    (code >= 0x2600 && code <= 0x26ff) || // Miscellaneous Symbols
    (code >= 0x2700 && code <= 0x27bf) || // Dingbats
    (code >= 0x1f900 && code <= 0x1f9ff) || // Supplemental Symbols
    code === 0x2728 || // Sparkles
    code === 0x27a1 || // Right Arrow
    code === 0x2b07 // Down Arrow
  );
}

function isBoldUnicode(char: string): boolean {
  const code = char.codePointAt(0)!;
  return (
    (code >= 0x1d400 && code <= 0x1d433) || // Bold A-Z
    (code >= 0x1d434 && code <= 0x1d44d) || // Bold a-z
    (code >= 0x1d56c && code <= 0x1d59f) || // Bold Italic A-Z
    (code >= 0x1d5a0 && code <= 0x1d5b9) // Bold Italic a-z
  );
}

export function countLinkedInChars(text: string): number {
  let count = 0;
  for (const char of text) {
    if (isEmoji(char)) {
      count += 2;
    } else if (isBoldUnicode(char)) {
      count += 2;
    } else {
      count += 1;
    }
  }
  return count;
}
