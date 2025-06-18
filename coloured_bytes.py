import numpy as np
from PIL import Image
import asyncio
import websockets
import json
import PIL.Image
from io import BytesIO
# import base64
import matplotlib.cm as cm
import time

ui_client = None

# Step 1: Convert (n, n, n) RGB image → grayscale (just one channel)
def rgb_to_grayscale(rgb_image):
    return rgb_image[..., 0]  # All channels are equal

# Step 2: Apply matplotlib colormap to grayscale image
def apply_colormap(gray_image, cmap_name='inferno'):
    try:
        cmap = cm.colormaps[cmap_name] 
    except AttributeError:
        cmap = cm.get_cmap(cmap_name)
    
    normed = gray_image / 255.0
    colored = cmap(normed)[..., :3]  # Drop alpha channel
    return (colored * 255).astype(np.uint8)

# Step 3: Return color-mapped frame (as array or PIL image)
def colormapped_image(frame, cmap_name='inferno', return_type='array'):
    gray = rgb_to_grayscale(frame)
    colored = apply_colormap(gray, cmap_name)
    if return_type == 'pil':
        return Image.fromarray(colored)
    return colored

async def process(websocket):
    frame_count = 0
    
    async for message in websocket:
        try:
            frame_count += 1
            process_start = time.perf_counter()
            
            # Reconstruct frame from raw bytes
            recv = np.frombuffer(message, dtype=np.uint8).reshape((720, 960, 3))
            
            # ✅ ADDED BACK: Apply colormap to the frame
            coloring_start = time.perf_counter()
            colored_frame = colormapped_image(recv, cmap_name='inferno')
            coloring_time = (time.perf_counter() - coloring_start) * 1000
            
            # Send colored frame to UI
            await send_to_ui(colored_frame)
            
            total_time = (time.perf_counter() - process_start) * 1000
            
            # Log performance every 5th frame
            if frame_count % 5 == 0:
                print(f"✅ Frame {frame_count}: Coloring={coloring_time:.1f}ms, Total={total_time:.1f}ms")
            
        except Exception as e:
            print(f"❌ Processing error: {e}")

async def handle_ui_client(websocket): 
    global ui_client
    ui_client = websocket
    print("🔗 UI client connected")
    
    try:
        await websocket.wait_closed()
    finally:
        ui_client = None
        print("🔌 UI client disconnected")

async def send_to_ui(frame):
    global ui_client
    if ui_client:
        try:
            send_start = time.perf_counter()
            
            # Convert to JPEG
            image = PIL.Image.fromarray(frame)
            im_file = BytesIO()
            image.save(im_file, format='JPEG', quality=85)
            jpeg_bytes = im_file.getvalue()
            
            # Send to UI
            await ui_client.send(jpeg_bytes)
            
            send_time = (time.perf_counter() - send_start) * 1000
            
            # Log send performance occasionally
            if hasattr(send_to_ui, 'call_count'):
                send_to_ui.call_count += 1
            else:
                send_to_ui.call_count = 1
            
            if send_to_ui.call_count % 10 == 0:
                print(f"📤 JPEG sent: {send_time:.1f}ms, Size: {len(jpeg_bytes)} bytes")

        except Exception as e:
            print(f"❌ Error sending to UI: {e}")
            ui_client = None

async def main(): 
    print("🚀 FPGA and laptop servers initialized with coloring")
    print("🎨 Using 'inferno' colormap")
    
    async with websockets.serve(
        process, 
        "192.168.137.1", 
        8002, 
        max_size=4 * 1024 * 1024  # Increased buffer size
    ) as fpga_server, \
    websockets.serve(
        handle_ui_client, 
        "localhost", 
        8001,
        max_size=4 * 1024 * 1024
    ) as ui_server:
        print("📡 FPGA server: 192.168.137.1:8002")
        print("🖥️  UI server: localhost:8001")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())