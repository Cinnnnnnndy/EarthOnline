#!/usr/bin/env python3
"""渲染后的轻后期：对比、饱和、高光偏暖、暗角、微颗粒"""
import sys, random
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw
def bloom(im, threshold=215, radius=18, amount=0.22):
    """辉光：取高光、模糊、叠加"""
    from PIL import ImageChops
    hi = im.point(lambda v: max(0, v - threshold) * 255 // max(1, 255 - threshold))
    hi = hi.filter(ImageFilter.GaussianBlur(radius))
    hi = ImageEnhance.Brightness(hi).enhance(amount)
    return ImageChops.add(im, hi)


def post(src, dst, vignette=0.22, warm=0.05, glow=True):
    im = Image.open(src).convert("RGB")
    if glow:
        im = bloom(im)
    im = ImageEnhance.Contrast(im).enhance(1.12); im = ImageEnhance.Color(im).enhance(1.18)
    lum = im.convert("L")
    warmL = Image.blend(im, Image.new("RGB", im.size, (255, 214, 160)), warm)
    coolL = Image.blend(im, Image.new("RGB", im.size, (40, 80, 150)), 0.06)
    im = Image.composite(warmL, coolL, lum.point(lambda v: min(255, int(v * 1.3))))
    vig = Image.new("L", im.size, 0); ImageDraw.Draw(vig).ellipse((-im.width * .2, -im.height * .3, im.width * 1.2, im.height * 1.3), 255); vig = vig.filter(ImageFilter.GaussianBlur(160))
    im = Image.composite(im, Image.blend(im, Image.new("RGB", im.size, (20, 30, 50)), vignette), vig)
    noise = Image.effect_noise(im.size, 14); im = Image.blend(im, Image.merge("RGB", (noise, noise, noise)), 0.03)
    im.save(dst, quality=92); print("saved", dst)
if __name__ == "__main__":
    post(sys.argv[1], sys.argv[2])
