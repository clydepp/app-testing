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

