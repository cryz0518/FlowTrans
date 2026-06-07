const sentenceBreakPattern = /([,，.。!！?？;；:：])/;

export function splitSubtitleLines(text: string, maxLineLength: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const lines: string[] = [];
  for (const segment of splitIntoSegments(normalized)) {
    appendSegment(lines, segment, maxLineLength);
  }
  return lines;
}

export function splitSubtitleSegments(text: string, maxSegmentLength: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const segments = splitIntoSegments(normalized);
  const chunks: string[] = [];
  let current = "";

  for (const segment of segments) {
    if (!current) {
      current = segment;
      continue;
    }

    const next = `${current}${segment}`;
    if (next.length <= maxSegmentLength || current.length < Math.floor(maxSegmentLength * 0.7)) {
      current = next;
    } else {
      chunks.push(current);
      current = segment;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.flatMap((chunk) => splitLongSegment(chunk, maxSegmentLength));
}

function splitIntoSegments(text: string): string[] {
  const parts = text.split(sentenceBreakPattern);
  const segments: string[] = [];
  for (let index = 0; index < parts.length; index += 2) {
    const body = parts[index] ?? "";
    const punctuation = parts[index + 1] ?? "";
    const segment = `${body}${punctuation}`.trim();
    if (segment) {
      segments.push(segment);
    }
  }
  return segments;
}

function splitLongSegment(text: string, maxSegmentLength: number): string[] {
  if (text.length <= maxSegmentLength * 1.35) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxSegmentLength * 1.35) {
    const breakAt = balanceShortTail(remaining, findBreakIndex(remaining, maxSegmentLength));
    chunks.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) {
    chunks.push(remaining);
  }
  return chunks;
}

function appendSegment(lines: string[], segment: string, maxLineLength: number) {
  let remaining = segment;
  while (remaining.length > maxLineLength) {
    const breakAt = balanceShortTail(remaining, findBreakIndex(remaining, maxLineLength));
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) {
    const previous = lines[lines.length - 1];
    if (previous && `${previous}${remaining}`.length <= maxLineLength) {
      lines[lines.length - 1] = `${previous}${remaining}`;
    } else {
      lines.push(remaining);
    }
  }
}

function findBreakIndex(text: string, maxLineLength: number) {
  const searchWindow = text.slice(0, maxLineLength + 1);
  const whitespaceIndex = searchWindow.lastIndexOf(" ");
  if (whitespaceIndex > 0 && whitespaceIndex >= Math.floor(maxLineLength * 0.55)) {
    return whitespaceIndex;
  }
  return maxLineLength;
}

function balanceShortTail(text: string, breakAt: number) {
  const tailLength = text.length - breakAt;
  if (tailLength > 0 && tailLength < 4 && breakAt > 6) {
    return text.length - 4;
  }
  return breakAt;
}
