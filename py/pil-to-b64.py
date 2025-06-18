import base64
from io import BytesIO
from PIL import Image

img = Image.open('test4.jpg')
im_file = BytesIO()
img.save(im_file, format="PNG")
im_byte = im_file.getvalue()

im_b64_string = base64.b64encode(im_byte).decode('utf-8')
# print(im_b64_string)
data_url = f"data:image/jpeg;base64,{im_b64_string}"

print(data_url)