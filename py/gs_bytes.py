import numpy as np
from PIL import Image
import asyncio
import websockets
import json
import PIL.Image
from io import BytesIO
# import base64
import matplotlib.cm as cm

ui_client = None

# Step 1: Convert (n, n, n) RGB image → grayscale (just one channel)
def rgb_to_grayscale(rgb_image):
    return rgb_image[..., 0]  # All channels are equal

# Step 2: Apply matplotlib colormap to grayscale image
def apply_colormap(gray_image, cmap_name='magma'):
    try:
        cmap = cm.colormaps[cmap_name] 
    except AttributeError:
        cmap = cm.get_cmap(cmap_name)
    
    normed = gray_image / 255.0
    colored = cmap(normed)[..., :3]  # Drop alpha channel
    return (colored * 255).astype(np.uint8)

# Step 3: Return color-mapped frame (as array or PIL image)
def colormapped_image(frame, cmap_name='magma', return_type='array'):
    gray = rgb_to_grayscale(frame)
    colored = apply_colormap(gray, cmap_name)
    if return_type == 'pil':
        return Image.fromarray(colored)
    return colored

async def process(websocket):
    async for message in websocket:
        try:
            recv = np.frombuffer(message, dtype=np.uint8).reshape((720,960,3))
            
            # ✅ CHANGED: Skip coloring and send raw frame directly
            await send_to_ui(recv)
            print("processed and sent raw frame")
            
        except Exception as e:
            print(f"error: {e}")

async def handle_ui_client(websocket): 
    global ui_client
    ui_client = websocket
    print("connected to ui")
    
    try:
        await websocket.wait_closed()
    finally:
        ui_client = None
        print("disconnected from ui")

async def send_to_ui(frame):
    global ui_client
    if ui_client:
        try:
            image = PIL.Image.fromarray(frame)
            im_file = BytesIO()
            image.save(im_file, format='JPEG', quality=85)
            jpeg_bytes = im_file.getvalue()

            await ui_client.send(jpeg_bytes)
            print("raw frame sent in binary format")

        except Exception as e:
            print(f"error sending to ui: {e}")
            ui_client = None

async def main(): 
    print("fpga and laptop servers initialised")
    
    async with websockets.serve(
        process, 
        "192.168.137.1", 
        8002, 
        max_size=3 * 1024 * 1024 
    ) as fpga_server, \
    websockets.serve(
        handle_ui_client, 
        "localhost", 
        8001,
        max_size=3 * 1024 * 1024
    ) as ui_server:
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())