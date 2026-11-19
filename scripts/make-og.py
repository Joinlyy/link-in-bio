# Builds public/og-image.png (1200x630), the picture shown when the site is shared.
from PIL import Image, ImageDraw, ImageFont
W, H = 1200, 630
INK, LIME, CREAM = (21, 22, 26), (213, 240, 92), (242, 241, 236)
img = Image.new('RGB', (W, H), INK)
d = ImageDraw.Draw(img)
bold = lambda n: ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', n)
reg = lambda n: ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', n)
logo = Image.open('public/logo.png').convert('RGBA').resize((96, 96))
img.paste(logo, (72, 64), logo)
d.text((188, 84), 'Joinlyy', font=bold(52), fill=CREAM)
d.text((72, 220), 'The link in bio', font=bold(88), fill=CREAM)
d.text((72, 320), 'for Indian creators', font=bold(88), fill=LIME)
d.text((72, 430), 'Sell with UPI  ·  Free Instagram comment to DM', font=reg(36), fill=(190, 190, 185))
d.text((72, 478), 'WhatsApp alerts  ·  Hindi & English', font=reg(36), fill=(190, 190, 185))
d.rounded_rectangle((72, 536, 360, 584), radius=22, fill=LIME)
d.text((100, 540), 'Start free', font=bold(30), fill=INK)
img.save('public/og-image.png', optimize=True)
print('ok')
