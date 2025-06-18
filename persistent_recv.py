import numpy as np
from PIL import Image
import asyncio
import websockets
import json
import PIL.Image
from io import BytesIO
import time
import zlib

ui_client = None

def rgb_to_grayscale(rgb_image):
    return rgb_image[..., 0]  # All channels are equal

async def process(websocket):
    """Process optimized frames from FPGA"""
    frame_count = 0
    
    async for message in websocket:
        try:
            frame_count += 1
            process_start = time.perf_counter()
            
            # Try to decompress first
            try:
                decompressed = zlib.decompress(message)
                frame_bytes = decompressed
                was_compressed = True
            except:
                frame_bytes = message
                was_compressed = False
            
            # Check if it's grayscale (1 channel) or RGB (3 channels)
            total_pixels = len(frame_bytes)
            if total_pixels == 720 * 960:  # Grayscale
                gray = np.frombuffer(frame_bytes, dtype=np.uint8).reshape((720, 960))
                # Convert back to RGB for UI
                recv = np.stack([gray, gray, gray], axis=2)
            else:  # RGB
                recv = np.frombuffer(frame_bytes, dtype=np.uint8).reshape((720, 960, 3))
            
            # Send raw frame to UI
            await send_to_ui(recv)
            
            process_time = (time.perf_counter() - process_start) * 1000
            
            # Log every 5th frame to reduce spam
            if frame_count % 5 == 0:
                compression_info = " (compressed)" if was_compressed else ""
                print(f"📥 Frame {frame_count}: {process_time:.1f}ms{compression_info}")
            
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
    """Send frame to UI with timing"""
    global ui_client
    if ui_client:
        try:
            convert_start = time.perf_counter()
            
            image = PIL.Image.fromarray(frame)
            im_file = BytesIO()
            image.save(im_file, format='JPEG', quality=75)  # Slightly lower quality for speed
            jpeg_bytes = im_file.getvalue()
            
            convert_time = time.perf_counter() - convert_start
            
            send_start = time.perf_counter()
            await ui_client.send(jpeg_bytes)
            send_time = time.perf_counter() - send_start
            
            total_time = (convert_time + send_time) * 1000
            
            # Log occasionally
            if hasattr(send_to_ui, 'call_count'):
                send_to_ui.call_count += 1
            else:
                send_to_ui.call_count = 1
            
            if send_to_ui.call_count % 10 == 0:
                print(f"📤 UI send: JPEG={convert_time*1000:.1f}ms, Send={send_time*1000:.1f}ms, Total={total_time:.1f}ms, Size={len(jpeg_bytes)} bytes")

        except ConnectionResetError:
            print("🔌 UI client disconnected during send")
            ui_client = None
        except Exception as e:
            print(f"❌ Error sending to UI: {e}")
            ui_client = None

async def main(): 
    print("🚀 FPGA and laptop servers initialized with persistent connections")
    
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
        print("📡 FPGA server: 192.168.137.1:8002 (persistent)")
        print("🖥️  UI server: localhost:8001")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())