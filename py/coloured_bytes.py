import numpy as np
from PIL import Image
import asyncio
import websockets
import json
import PIL.Image
from io import BytesIO

def apply_colormap_numpy(gray_image, cmap_name='inferno'):
    if cmap_name == 'gray':
        return np.stack([gray_image, gray_image, gray_image], axis=2)
    # Add this elif block to your apply_colormap_numpy function

    elif cmap_name == 'neon_green':
        normalized = gray_image / 255.0
        
        green_intensity = np.sin(normalized * np.pi) ** 2 * 255
        
        r = np.zeros_like(gray_image)  # No red
        g = green_intensity.astype(np.uint8)  # Green in middle range
        b = np.zeros_like(gray_image)  # No blue
        
        return np.stack([r, g, b], axis=2).astype(np.uint8)
    
    elif cmap_name == 'inferno':
        # Inferno-like: Black -> Purple -> Orange -> Yellow
        r = np.minimum(255, np.maximum(0, (gray_image.astype(np.int16) - 50) * 2))
        g = np.maximum(0, np.minimum(255, (gray_image.astype(np.int16) - 100) * 2))
        b = np.maximum(0, np.minimum(128, gray_image.astype(np.int16) - 128))
        return np.stack([r, g, b], axis=2).astype(np.uint8)
    
    elif cmap_name == 'blues':
        # Blue gradient: Black -> Blue -> Light Blue -> White
        r = np.maximum(0, (gray_image.astype(np.int16) - 200) * 5)
        g = np.maximum(0, (gray_image.astype(np.int16) - 150) * 2)
        b = np.minimum(255, gray_image * 1.5)
        return np.stack([r, g, b], axis=2).astype(np.uint8)

    else:
        return np.stack([gray_image, gray_image, gray_image], axis=2)

COLORMAP_MAPPING = {
    'grayscale': 'gray',
    'classic': 'blues', 
    'sunset': 'inferno',
    'neon_green': 'neon_green' 
}

ui_client = None
current_colormap = 'inferno'
cached_grayscale_frame = None

def rgb_to_grayscale(rgb_image):
    return rgb_image[..., 0]

def colormapped_image(frame, cmap_name=None, return_type='array'):
    gray = rgb_to_grayscale(frame)
    cmap_to_use = cmap_name or current_colormap
    colored = apply_colormap_numpy(gray, cmap_to_use)
    
    if return_type == 'pil':
        return Image.fromarray(colored)
    return colored

async def process(websocket):
    global cached_grayscale_frame
    frame_count = 0
    
    async for message in websocket:
        try:
            frame_count += 1
            recv = np.frombuffer(message, dtype=np.uint8).reshape((720, 960, 3))
            cached_grayscale_frame = rgb_to_grayscale(recv).copy()
            colored_frame = apply_colormap_numpy(cached_grayscale_frame, current_colormap)

            await send_to_ui(colored_frame)

        except Exception as e:
            print(f"Processing error: {e}")

async def recolor_cached_frame():
    global cached_grayscale_frame, current_colormap
    if cached_grayscale_frame is not None:
        try:
            colored_frame = apply_colormap_numpy(cached_grayscale_frame, current_colormap)
        
            await send_to_ui(colored_frame)
            
 
        except Exception as e:
            print(f"Recoloring error: {e}")

async def handle_ui_client(websocket): 
    global ui_client, current_colormap
    ui_client = websocket
    print("UI connected")
    
    try:
        async for message in websocket:
            try:
                if isinstance(message, str):
                    settings = json.loads(message)
                    
                    if 'colormap' in settings:
                        scheme = settings['colormap']
                        new_colormap = COLORMAP_MAPPING.get(scheme, 'inferno')

                        if new_colormap != current_colormap:
                            current_colormap = new_colormap
                            
                            await recolor_cached_frame()
                        
                elif isinstance(message, bytes):
                    print("Received binary message from UI (unexpected)")
                    
            except json.JSONDecodeError:
                print("Received invalid JSON message from UI")
            except Exception as e:
                print(f"Error processing UI message: {e}")
    except websockets.exceptions.ConnectionClosed:
        print("UI client disconnected")
    finally:
        ui_client = None

async def send_to_ui(frame):
    global ui_client
    if ui_client:
        try:
            
            image = PIL.Image.fromarray(frame)
            im_file = BytesIO()
            image.save(im_file, format='JPEG', quality=85)
            jpeg_bytes = im_file.getvalue()
            
            await ui_client.send(jpeg_bytes)
            
            if hasattr(send_to_ui, 'call_count'):
                send_to_ui.call_count += 1
            else:
                send_to_ui.call_count = 1

        except Exception as e:
            print(f"Error sending to UI: {e}")
            ui_client = None

async def main(): 
    async with websockets.serve(
        process, 
        "192.168.137.1", 
        8002, 
        max_size=4 * 1024 * 1024
    ) as fpga_server, \
    websockets.serve(
        handle_ui_client, 
        "localhost", 
        8001,
        max_size=4 * 1024 * 1024
    ) as ui_server:
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())