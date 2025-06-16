
import asyncio
import websockets
import json
import threading
from qformatpy import qformat
from pynq import Overlay
from pynq.lib.video import *
import PIL.Image
from io import BytesIO
import base64

# Install websockets if needed
try:
    import websockets
except ImportError:
    import subprocess
    subprocess.check_call(["pip", "install", "websockets"])
    import websockets

# PYNQ Setup
# overlay = Overlay("/home/xilinx/32_bit_zoom_2.bit")
imgen_vdma = overlay.video.axi_vdma_0.readchannel
pixgen = overlay.pixel_generator_0

videoMode = common.VideoMode(640, 480, 24)
imgen_vdma.mode = videoMode
imgen_vdma.start()

def generate_frame_with_params(params): # params is a json object: re_c
    # Convert to Q4.28 format
    re_c_q = qformat(params.get('re_c', -0.5), 4, 28)
    im_c_q = qformat(params.get('im_c', 0.0), 4, 28)
    
    # Set FPGA registers
    pixgen.register_map.gp0 = params.get('max_iter', 200)       
    pixgen.register_map.gp1 = int(params.get('zoom', 1))            
    pixgen.register_map.gp2 = re_c_q   
    pixgen.register_map.gp3 = im_c_q

    # Generate frame
    frame = imgen_vdma.readframe()
    image = PIL.Image.fromarray(frame)
    im_file = BytesIO()
    image.save(im_file, format='PNG')

    # Return base64 data URI
    im_b64_string = base64.b64encode(im_file.getvalue()).decode('utf-8')
    return f"data:image/png;base64,{im_b64_string}"

async def handle_websocket(websocket, path):
    print(f"Client connected from {websocket.remote_address}")
    try:
        async for message in websocket:
            try:
                params = json.loads(message)
                print(f"Received params: {params}")
                
                # Generate frame with FPGA
                base_rep = generate_frame_with_params(params)
                
                # Send back to client
                await websocket.send(base_rep)
                print("Sent fractal image to client")
                
            except json.JSONDecodeError as e:
                print(f"JSON decode error: {e}")
                await websocket.send(json.dumps({"error": "Invalid JSON"}))
            except Exception as e:
                print(f"Error processing message: {e}")
                await websocket.send(json.dumps({"error": str(e)}))
                
    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")

def start_websocket_server():
    # Create new event loop for this thread
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    # Start server on port 8000 (no routing needed)
    start_server = websockets.serve(handle_websocket, "0.0.0.0", 8000)
    loop.run_until_complete(start_server)
    print("WebSocket server running on ws://192.168.137.175:8000")
    loop.run_forever()

# Start server in background thread
server_thread = threading.Thread(target=start_websocket_server, daemon=True)
server_thread.start()

print("Starting WebSocket server...")
print("Server will be available at ws://192.168.137.175:8000")
print("No /websocket endpoint needed - connect directly to ws://192.168.137.175:8000")

# Keep the cell running
import time
time.sleep(2)
print("✅ WebSocket server is running!")