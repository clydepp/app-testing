import numpy as np
from PIL import Image
import asyncio
import websockets
import json
import PIL.Image
from io import BytesIO
import cv2  # ← New import
import time

ui_client = None

# ✅ OpenCV colormaps (much faster than matplotlib)
OPENCV_COLORMAPS = {
    'inferno': cv2.COLORMAP_INFERNO,
    'magma': cv2.COLORMAP_MAGMA,
    'plasma': cv2.COLORMAP_PLASMA,
    'viridis': cv2.COLORMAP_VIRIDIS,
    'hot': cv2.COLORMAP_HOT,
    'cool': cv2.COLORMAP_COOL,
    'jet': cv2.COLORMAP_JET,
    'turbo': cv2.COLORMAP_TURBO
}

def rgb_to_grayscale(rgb_image):
    return rgb_image[..., 0]  # All channels are equal

def apply_colormap_opencv(gray_image, cmap_name='inferno'):
    """Ultra-fast colormap using OpenCV"""
    if cmap_name not in OPENCV_COLORMAPS:
        print(f"❌ Colormap {cmap_name} not available, using inferno")
        cmap_name = 'inferno'
    
    # ✅ SUPER FAST: OpenCV colormap (optimized C++)
    colored = cv2.applyColorMap(gray_image, OPENCV_COLORMAPS[cmap_name])
    
    # Convert BGR to RGB
    colored_rgb = cv2.cvtColor(colored, cv2.COLOR_BGR2RGB)
    
    return colored_rgb

async def process(websocket):
    async for message in websocket:
        try:
            start_time = time.perf_counter()
            
            recv = np.frombuffer(message, dtype=np.uint8).reshape((720, 960, 3))
            
            # ✅ Apply OpenCV coloring (change this line to enable/disable)
            # Option 1: Raw frame (current)
            # await send_to_ui(recv)
            
            # Option 2: OpenCV colored frame (uncomment to enable)
            gray = rgb_to_grayscale(recv)
            colored_frame = apply_colormap_opencv(gray, 'inferno')
            await send_to_ui(colored_frame)
            
            end_time = time.perf_counter()
            processing_time = (end_time - start_time) * 1000
            print(f"✅ OpenCV frame processed in {processing_time:.2f}ms")
            
        except Exception as e:
            print(f"❌ Processing error: {e}")

async def handle_ui_client(websocket): 
    global ui_client
    ui_client = websocket
    print("🔗 Connected to UI")
    
    try:
        await websocket.wait_closed()
    finally:
        ui_client = None
        print("🔌 Disconnected from UI")

async def send_to_ui(frame):
    global ui_client
    if ui_client:
        try:
            image = PIL.Image.fromarray(frame)
            im_file = BytesIO()
            image.save(im_file, format='JPEG', quality=85)
            jpeg_bytes = im_file.getvalue()

            await ui_client.send(jpeg_bytes)
            print(f"📤 Frame sent to UI ({len(jpeg_bytes)} bytes)")

        except Exception as e:
            print(f"❌ Error sending to UI: {e}")
            ui_client = None

async def main(): 
    print("🚀 FPGA and laptop servers initialized with OpenCV")
    print(f"✅ Available colormaps: {list(OPENCV_COLORMAPS.keys())}")
    
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