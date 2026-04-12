#!/usr/bin/env python3
"""
Generate a monochrome terminal-themed Open Graph image.

Output:
  test/og-card.png
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


WIDTH = 1200
HEIGHT = 630


def load_font(candidates: list[str], size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in candidates:
        p = Path(candidate)
        if p.exists():
            try:
                return ImageFont.truetype(str(p), size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def main() -> None:
    out_path = Path(__file__).resolve().parent / "og-card.png"

    bg = (14, 16, 20)
    surface = (21, 24, 30)
    surface_soft = (27, 31, 39)
    line = (58, 64, 76)
    text = (239, 242, 247)
    text_soft = (178, 187, 202)
    text_muted = (130, 139, 155)

    img = Image.new("RGB", (WIDTH, HEIGHT), bg)
    draw = ImageDraw.Draw(img)

    # Background radial glow
    glow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse((-180, -260, 760, 680), fill=(210, 220, 245, 20))
    gdraw.ellipse((620, -220, 1420, 520), fill=(210, 220, 245, 16))
    glow = glow.filter(ImageFilter.GaussianBlur(58))
    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
    draw = ImageDraw.Draw(img)

    # Subtle grid
    step = 40
    for x in range(0, WIDTH, step):
        draw.line([(x, 0), (x, HEIGHT)], fill=(43, 47, 58), width=1)
    for y in range(0, HEIGHT, step):
        draw.line([(0, y), (WIDTH, y)], fill=(43, 47, 58), width=1)

    # Main frame
    card_x = 82
    card_y = 72
    card_w = WIDTH - (card_x * 2)
    card_h = HEIGHT - (card_y * 2)

    draw.rounded_rectangle(
        (card_x, card_y, card_x + card_w, card_y + card_h),
        radius=26,
        fill=surface,
        outline=line,
        width=2,
    )

    # Top terminal bar
    top_h = 54
    draw.rounded_rectangle(
        (card_x + 1, card_y + 1, card_x + card_w - 1, card_y + top_h),
        radius=24,
        fill=surface_soft,
        outline=None,
    )
    draw.line(
        [(card_x + 18, card_y + top_h), (card_x + card_w - 18, card_y + top_h)],
        fill=line,
        width=1,
    )

    dot_y = card_y + 27
    for i in range(3):
        cx = card_x + 30 + (i * 18)
        draw.ellipse((cx - 4, dot_y - 4, cx + 4, dot_y + 4), fill=(158, 167, 183))

    mono = load_font(
        [
            "/System/Library/Fonts/Supplemental/Menlo.ttc",
            "/System/Library/Fonts/Supplemental/Courier New Bold.ttf",
            "/System/Library/Fonts/Supplemental/Andale Mono.ttf",
        ],
        size=22,
    )
    mono_small = load_font(
        [
            "/System/Library/Fonts/Supplemental/Menlo.ttc",
            "/System/Library/Fonts/Supplemental/Courier New.ttf",
        ],
        size=16,
    )
    display = load_font(
        [
            "/System/Library/Fonts/Supplemental/Avenir Next Condensed Bold.ttf",
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        ],
        size=78,
    )

    draw.text((card_x + 95, card_y + 17), "bsky.md", fill=text_muted, font=mono_small)

    # Badge
    badge_x = card_x + card_w - 290
    badge_y = card_y + 15
    draw.rounded_rectangle(
        (badge_x, badge_y, badge_x + 210, badge_y + 26),
        radius=13,
        fill=surface,
        outline=(88, 95, 109),
        width=1,
    )
    draw.text((badge_x + 14, badge_y + 5), "TEXT/MARKDOWN API", fill=text_soft, font=mono_small)

    # Headline
    head_x = card_x + 54
    head_y = card_y + 108
    draw.text((head_x, head_y), "Bluesky -> Markdown", fill=text, font=display)

    # Supporting copy
    body = (
        "Minimal, terminal-native output for profiles, posts, threads, "
        "feeds, links, search, and trending topics."
    )
    draw.text((head_x, head_y + 100), body, fill=text_soft, font=mono_small)

    # Command block
    block_x = head_x
    block_y = head_y + 162
    block_w = card_w - 108
    block_h = 160
    draw.rounded_rectangle(
        (block_x, block_y, block_x + block_w, block_y + block_h),
        radius=16,
        fill=(12, 14, 17),
        outline=(72, 79, 92),
        width=1,
    )

    lines = [
        "$ curl https://bsky.md/profile/bsky.app",
        "# clean markdown output, no auth required",
        "$ curl https://bsky.md/profile/bsky.app/post/3lhreomsy5k2x/thread",
    ]

    y = block_y + 20
    for i, line_text in enumerate(lines):
        color = text if i != 1 else text_muted
        draw.text((block_x + 20, y), line_text, fill=color, font=mono)
        y += 44

    # Footer strip
    foot_y = card_y + card_h - 56
    draw.line(
        [(card_x + 24, foot_y), (card_x + card_w - 24, foot_y)],
        fill=line,
        width=1,
    )
    draw.text((card_x + 30, foot_y + 18), "Content-Type: text/markdown", fill=text_muted, font=mono_small)
    draw.text((card_x + card_w - 190, foot_y + 18), "https://bsky.md", fill=text_muted, font=mono_small)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, format="PNG", optimize=True)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
