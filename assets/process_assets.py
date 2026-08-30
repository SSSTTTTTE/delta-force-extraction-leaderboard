"""Crop + process assets from the reference render for the leaderboard page."""
from PIL import Image, ImageFilter, ImageEnhance
import os

SRC = "/Users/hooked4st/paihangbang/assets/reference.png"
OUT = "/Users/hooked4st/paihangbang/app/public/assets"
os.makedirs(OUT, exist_ok=True)

ref = Image.open(SRC).convert("RGB")
W, H = ref.size
print("reference size:", ref.size)


def lum_alpha(crop: Image.Image, gain: float = 1.15, floor: int = 10) -> Image.Image:
    """Convert a bright-on-dark crop to RGBA using luminance as alpha."""
    crop = crop.convert("RGB")
    px = crop.load()
    out = Image.new("RGBA", crop.size)
    op = out.load()
    for y in range(crop.size[1]):
        for x in range(crop.size[0]):
            r, g, b = px[x, y]
            a = int(max(0.0, min(255.0, (0.299 * r + 0.587 * g + 0.114 * b) * gain)))
            if a < floor:
                a = 0
            op[x, y] = (r, g, b, a)
    return out


def save_crop(box, name, gain=1.15, floor=10):
    c = ref.crop(box)
    la = lum_alpha(c, gain, floor)
    la.save(os.path.join(OUT, name))
    print(name, la.size)


# 1. Ambient background: heavy blur + darken, kills baked-in text ghosts
bg = ref.filter(ImageFilter.GaussianBlur(30))
bg = ImageEnhance.Brightness(bg).enhance(0.8)
bg.save(os.path.join(OUT, "bg_ambient.jpg"), quality=84)
print("bg_ambient.jpg", bg.size)

# 2. Logo (green triangle + 三角洲行动 / DELTA FORCE), top-left
save_crop((18, 10, 205, 75), "logo.png", gain=1.25)

# 3. Podium emblems (winged badges)
save_crop((428, 298, 598, 450), "emblem_gold.png")
save_crop((162, 326, 318, 460), "emblem_silver.png")
save_crop((732, 356, 874, 484), "emblem_bronze.png")

# 4. Crown above rank-1 tab
save_crop((478, 176, 550, 218), "crown.png", gain=1.2)

# 5. Small rank badges in table rows 1-3
save_crop((88, 700, 158, 766), "badge1.png", gain=1.2)
save_crop((88, 776, 158, 828), "badge2.png", gain=1.2)
save_crop((88, 832, 158, 882), "badge3.png", gain=1.2)

# 6. Green triangle mark for footer-right (reuse from logo crop, tight)
save_crop((20, 14, 64, 66), "tri.png", gain=1.3)
