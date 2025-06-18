# Cell for receiving UI parameters
import asyncio
import websockets
import json
from qformatpy import qformat
import numpy as np
import PIL

pixgen = overlay.pixel_generator_0

async def handle_ui_parameters(websocket, path):
    try:
        async for message in websocket:
            try:
                params = json.loads(message)
                
                # Update FPGA registers with new parameters
                re_c_q = qformat(params.get('re_c', -0.5), 4, 28)
                im_c_q = qformat(params.get('im_c', 0.0), 4, 28)
                
                max_iter_log = int(params.get('max_iter', 1))  # Need power of 2 for this
                max_iter = 2 ** max_iter_log
                pixgen.register_map.gp0 = max_iter
                pixgen.register_map.gp1 = max_iter_log
                pixgen.register_map.gp2 = int(params.get('zoom', 1))            
                pixgen.register_map.gp3 = re_c_q   
                pixgen.register_map.gp4 = im_c_q
              
                print(pixgen.register_map)
                
                frame = imgen_vdma.readframe()
                image = PIL.Image.fromarray(frame)
                image
                
                send_frame(frame)
                print("sent frame")
                
            except Exception as e:
                print(f"error: {e}")
                
    except websockets.exceptions.ConnectionClosed:
        print("disconnected ui")

# Start parameter server
async def start_param_server():
    async with websockets.serve(handle_ui_parameters, "0.0.0.0", 8080):
        await asyncio.Future()

# Run this once to start parameter server
task = asyncio.create_task(start_param_server())
print("✅ Server task created and running in background")
print(f"Task: {task}")