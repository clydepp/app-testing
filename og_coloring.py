# 3rd: Colour frame
import PIL.Image
import time
import numpy as np
from pynq import allocate
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.cm as cm
from PIL import Image

# Controlling image parameters

pixgen = overlay.pixel_generator_0

max_iter = 32
max_iter_log = np.log2(max_iter)
zoom = 0
real_center = 0xF4000000
imag_center = 0x0199999A
wait_stages = 0

pixgen.register_map.gp0 = max_iter
pixgen.register_map.gp1 = max_iter_log
pixgen.register_map.gp2 = zoom
pixgen.register_map.gp3 = real_center
pixgen.register_map.gp4 = imag_center
pixgen.register_map.gp5 = wait_stages
frame = imgen_vdma.readframe()

# Step 1: Convert (n, n, n) RGB image → grayscale (just one channel)
def rgb_to_grayscale(rgb_image):
    return rgb_image[..., 0]  # All channels are equal

# Step 2: Apply matplotlib colormap to grayscale image
def apply_colormap(gray_image, cmap_name='turbo'):
    cmap = cm.get_cmap(cmap_name)
    normed = gray_image / 255.0
    colored = cmap(normed)[..., :3]  # Drop alpha channel
    return (colored * 255).astype(np.uint8)

# Step 3: Return color-mapped frame (as array or PIL image)
def colormapped_image(frame, cmap_name='turbo', return_type='array'):
    gray = rgb_to_grayscale(frame)
    colored = apply_colormap(gray, cmap_name)
    if return_type == 'pil':
        return Image.fromarray(colored)
    return colored  # returns a NumPy array (H, W, 3)

# Get the new image in NumPy array form
new_frame = colormapped_image(frame, cmap_name='turbo')
hdmi_swapped_frame = new_frame[..., [2, 1, 0]]  # RGB → BGR for HDMI output


image = PIL.Image.fromarray(new_frame)
image