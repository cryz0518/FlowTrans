import { describe, expect, it } from "vitest";

import { splitSubtitleLines, splitSubtitleSegments } from "./subtitleLineBreaks";

describe("splitSubtitleLines", () => {
  it("splits long Chinese text into readable lyric-style lines", () => {
    expect(splitSubtitleLines("这是一段很长的中文字幕内容，需要像桌面歌词一样分成几行显示。", 14)).toEqual([
      "这是一段很长的中文字幕内容，",
      "需要像桌面歌词一样分成几",
      "行显示。",
    ]);
  });

  it("splits long English text at word boundaries", () => {
    expect(splitSubtitleLines("This is a long English subtitle that should wrap softly", 18)).toEqual([
      "This is a long",
      "English subtitle",
      "that should wrap",
      "softly",
    ]);
  });
});

describe("splitSubtitleSegments", () => {
  it("splits long translated text into staged subtitle segments", () => {
    expect(splitSubtitleSegments("今天非常高兴，我们一起去游乐园，吃了棒棒糖，冰淇淋，过山车。", 18)).toEqual([
      "今天非常高兴，我们一起去游乐园，",
      "吃了棒棒糖，冰淇淋，过山车。",
    ]);
  });
});
